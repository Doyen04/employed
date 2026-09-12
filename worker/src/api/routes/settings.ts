import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../../prisma'
import { encryptJson, decryptJson } from '../../utils/json'
import { pickDefined } from '../../utils/pickDefined'
import { getMonitoredChatRefusal } from '../../prisma/chats'
import { toJsonValue } from '../../types/json'
import { resolveSmtp, sendSmtpMail } from '../../actions/notifiers/email'
import type { ActionRule, AnalysisConfig, Notifier } from '../../generated/prisma/client'

export const settingsRouter = Router()

const NOTIFIER_TYPES = ['telegram', 'email', 'webhook', 'push', 'slack'] as const

function serializeConfig(config: AnalysisConfig & { allowedChats?: { id: string }[] }) {
    return {
        id: config.id,
        name: config.name,
        promptTemplate: config.promptTemplate,
        outputSchema: config.outputSchema,
        isActive: config.isActive,
        createdAt: config.createdAt.toISOString(),
        allowedChatIds: config.allowedChats?.map((chat) => chat.id) ?? [],
    }
}

function serializeNotifier(notifier: Notifier) {
  let telegramTargetChatId: string | null = null
  let configEmailTo: string | null = null
  if (notifier.type === 'telegram' && typeof notifier.config === 'string') {
    const decrypted = decryptJson<{ targetChatId?: unknown }>(notifier.config, {})
    if (typeof decrypted.targetChatId === 'string') telegramTargetChatId = decrypted.targetChatId
  }
  if (notifier.type === 'email' && typeof notifier.config === 'string') {
    const decrypted = decryptJson<{ to?: unknown }>(notifier.config, {})
    if (typeof decrypted.to === 'string' && decrypted.to.trim()) configEmailTo = decrypted.to.trim()
  }
  return {
    id: notifier.id,
    type: notifier.type,
    name: notifier.name,
    isActive: notifier.isActive,
    configConfigured: true,
    telegramTargetChatId,
    configEmailTo,
  }
}

function serializeRule(rule: ActionRule & { notifier: { id: string; name: string; type: string } }) {
    return {
        id: rule.id,
        analysisConfigId: rule.analysisConfigId,
        condition: rule.condition,
        notifierId: rule.notifierId,
        notifierName: rule.notifier.name,
        notifierType: rule.notifier.type,
        isActive: rule.isActive,
    }
}

settingsRouter.get('/', async (_req, res) => {
    const [analysisConfigs, actionRules, notifiers] = await Promise.all([
        prisma.analysisConfig.findMany({
            orderBy: { createdAt: 'asc' },
            include: { allowedChats: { select: { id: true } } },
        }),
        prisma.actionRule.findMany({ orderBy: { id: 'asc' }, include: { notifier: true } }),
        prisma.notifier.findMany({ orderBy: { id: 'asc' } }),
    ])

    res.json({
        analysisConfigs: analysisConfigs.map(serializeConfig),
        actionRules: actionRules.map(serializeRule),
        notifiers: notifiers.map(serializeNotifier),
    })
})

const configSchema = z.object({
    name: z.string().min(1),
    promptTemplate: z.string().min(1),
    outputSchema: z.record(z.string(), z.unknown()),
    isActive: z.boolean().default(true),
    allowedChatIds: z.array(z.string()).optional(),
})

settingsRouter.post('/analysis-configs', async (req, res) => {
    const body = configSchema.parse(req.body ?? {})
    const config = await prisma.analysisConfig.create({
        data: {
            name: body.name,
            promptTemplate: body.promptTemplate,
            outputSchema: toJsonValue(body.outputSchema),
            isActive: body.isActive,
            allowedChats: body.allowedChatIds?.length
                ? { connect: body.allowedChatIds.map((chatId) => ({ id: chatId })) }
                : undefined,
        },
        include: { allowedChats: { select: { id: true } } },
    })
    res.status(201).json(serializeConfig(config))
})

settingsRouter.patch('/analysis-configs/:id', async (req, res) => {
    const body = configSchema.partial().parse(req.body ?? {})
    const config = await prisma.analysisConfig.update({
        where: { id: req.params.id },
        data: pickDefined({
            name: body.name,
            promptTemplate: body.promptTemplate,
            outputSchema: body.outputSchema !== undefined ? toJsonValue(body.outputSchema) : undefined,
            isActive: body.isActive,
            allowedChats: body.allowedChatIds !== undefined
                ? { set: body.allowedChatIds.map((chatId) => ({ id: chatId })) }
                : undefined,
        }) as Parameters<typeof prisma.analysisConfig.update>[0]['data'],
        include: { allowedChats: { select: { id: true } } },
    })
    res.json(serializeConfig(config))
})

settingsRouter.delete('/analysis-configs/:id', async (req, res) => {
    await prisma.analysisConfig.delete({ where: { id: req.params.id } })
    res.status(204).end()
})

const notifierSchema = z.object({
    type: z.enum(NOTIFIER_TYPES),
    name: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
    isActive: z.boolean().default(true),
})

async function assertNotifierAllowed(
    candidate: { type: string; config: Record<string, unknown> },
): Promise<string | null> {
    if (candidate.type !== 'telegram') return null
    const raw = candidate.config.targetChatId
    if (typeof raw !== 'string' || !raw.trim()) return null
    return getMonitoredChatRefusal(raw.trim())
}

settingsRouter.post('/notifiers', async (req, res) => {
    const body = notifierSchema.parse(req.body ?? {})
    const disallowed = await assertNotifierAllowed(body)
    if (disallowed) {
        return res.status(400).json({ ok: false, error: disallowed })
    }
    const notifier = await prisma.notifier.create({
        data: {
            type: body.type,
            name: body.name,
            isActive: body.isActive,
            config: encryptJson(body.config),
        },
    })
    res.status(201).json(serializeNotifier(notifier))
})

settingsRouter.patch('/notifiers/:id', async (req, res) => {
    const body = notifierSchema.partial().parse(req.body ?? {})
    const notifier = await prisma.notifier.findUnique({ where: { id: req.params.id } })
    if (!notifier) return res.status(404).json({ ok: false, error: 'notifier not found' })

    if (body.config !== undefined) {
        const disallowed = await assertNotifierAllowed({
            type: body.type ?? notifier.type,
            config: body.config,
        })
        if (disallowed) {
            return res.status(400).json({ ok: false, error: disallowed })
        }
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.type !== undefined) data.type = body.type
    if (body.config !== undefined) {
        data.config = encryptJson(body.config)
    }
    const updated = await prisma.notifier.update({
        where: { id: req.params.id },
        data: data as Parameters<typeof prisma.notifier.update>[0]['data'],
    })
    res.json(serializeNotifier(updated))
})

settingsRouter.delete('/notifiers/:id', async (req, res) => {
    await prisma.notifier.delete({ where: { id: req.params.id } })
    res.status(204).end()
})

settingsRouter.post('/notifiers/:id/test', async (req, res) => {
    const body = z.object({ to: z.string().optional() }).parse(req.body ?? {})
    const notifier = await prisma.notifier.findUnique({ where: { id: req.params.id } })
    if (!notifier) {
        return res.status(404).json({ ok: false, error: 'notifier not found' })
    }
    if (notifier.type !== 'email') {
        return res.status(400).json({ ok: false, error: 'test is only supported for email notifiers' })
    }

    const config = typeof notifier.config === 'string' ? decryptJson<Record<string, unknown>>(notifier.config, {}) : {}
    const resolved = resolveSmtp(config)
    if (!resolved.ok) {
        return res.status(400).json({ ok: false, error: resolved.error })
    }

    const to = body.to?.trim() || String(config.to ?? '').trim()
    if (!to) {
        return res
            .status(400)
            .json({ ok: false, error: 'email notifier has no recipient — set config.to or pass a test address' })
    }

    const result = await sendSmtpMail({
        from: resolved.from,
        connection: resolved.connection,
        to,
        subject: 'Employed — test email',
        text: 'This is a test email from your Employed worker. SMTP is working.',
    })
    if (result.status === 'failed') {
        return res.status(400).json({ ok: false, error: result.error ?? 'send failed' })
    }
    res.json({ ok: true })
})

const ruleSchema = z.object({
    analysisConfigId: z.string().min(1),
    condition: z.record(z.string(), z.unknown()),
    notifierId: z.string().min(1),
    isActive: z.boolean().default(true),
})

settingsRouter.post('/action-rules', async (req, res) => {
    const body = ruleSchema.parse(req.body ?? {})
    const rule = await prisma.actionRule.create({
        data: {
            analysisConfigId: body.analysisConfigId,
            condition: toJsonValue(body.condition),
            notifierId: body.notifierId,
            isActive: body.isActive,
        },
        include: { notifier: true },
    })
    res.status(201).json(serializeRule(rule))
})

settingsRouter.patch('/action-rules/:id', async (req, res) => {
    const body = ruleSchema.partial().parse(req.body ?? {})
    const rule = await prisma.actionRule.update({
        where: { id: req.params.id },
        data: pickDefined({
            analysisConfigId: body.analysisConfigId,
            condition: body.condition !== undefined ? toJsonValue(body.condition) : undefined,
            notifierId: body.notifierId,
            isActive: body.isActive,
        }) as Parameters<typeof prisma.actionRule.update>[0]['data'],
        include: { notifier: true },
    })
    res.json(serializeRule(rule))
})

settingsRouter.delete('/action-rules/:id', async (req, res) => {
    await prisma.actionRule.delete({ where: { id: req.params.id } })
    res.status(204).end()
})