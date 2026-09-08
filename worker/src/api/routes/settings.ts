import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../../prisma'
import { encryptSecret } from '../../crypto'
import { toJsonValue } from '../../types/json'
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
    return {
        id: notifier.id,
        type: notifier.type,
        name: notifier.name,
        isActive: notifier.isActive,
        configConfigured: true,
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
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.promptTemplate !== undefined) data.promptTemplate = body.promptTemplate
    if (body.outputSchema !== undefined) data.outputSchema = toJsonValue(body.outputSchema)
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.allowedChatIds !== undefined) {
        data.allowedChats = { set: body.allowedChatIds.map((chatId) => ({ id: chatId })) }
    }
    const config = await prisma.analysisConfig.update({
        where: { id: req.params.id },
        data: data as Parameters<typeof prisma.analysisConfig.update>[0]['data'],
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

settingsRouter.post('/notifiers', async (req, res) => {
    const body = notifierSchema.parse(req.body ?? {})
    const notifier = await prisma.notifier.create({
        data: {
            type: body.type,
            name: body.name,
            isActive: body.isActive,
            config: encryptSecret(JSON.stringify(body.config)),
        },
    })
    res.status(201).json(serializeNotifier(notifier))
})

settingsRouter.patch('/notifiers/:id', async (req, res) => {
    const body = notifierSchema.partial().parse(req.body ?? {})
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.type !== undefined) data.type = body.type
    if (body.config !== undefined) {
        data.config = encryptSecret(JSON.stringify(body.config))
    }
    const notifier = await prisma.notifier.update({
        where: { id: req.params.id },
        data: data as Parameters<typeof prisma.notifier.update>[0]['data'],
    })
    res.json(serializeNotifier(notifier))
})

settingsRouter.delete('/notifiers/:id', async (req, res) => {
    await prisma.notifier.delete({ where: { id: req.params.id } })
    res.status(204).end()
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
    const data: Record<string, unknown> = {}
    if (body.analysisConfigId !== undefined) data.analysisConfigId = body.analysisConfigId
    if (body.condition !== undefined) data.condition = toJsonValue(body.condition)
    if (body.notifierId !== undefined) data.notifierId = body.notifierId
    if (body.isActive !== undefined) data.isActive = body.isActive
    const rule = await prisma.actionRule.update({
        where: { id: req.params.id },
        data: data as Parameters<typeof prisma.actionRule.update>[0]['data'],
        include: { notifier: true },
    })
    res.json(serializeRule(rule))
})

settingsRouter.delete('/action-rules/:id', async (req, res) => {
    await prisma.actionRule.delete({ where: { id: req.params.id } })
    res.status(204).end()
})