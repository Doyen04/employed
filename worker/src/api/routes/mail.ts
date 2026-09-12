import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../../prisma'
import { decryptJson } from '../../utils/json'
import { parseLimit, parseCursor, buildPage } from '../../utils/pagination'
import { chatRef } from '../serializers'
import { resolveSmtp, sendSmtpMail } from '../../actions/notifiers/email'
import { buildNotificationText } from '../../actions/notifiers/format'
import type { NotificationPayload } from '../../actions/types'

export const mailRouter = Router()

function asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>
    }
    return { raw: value }
}

// GET /mail — analysed messages ("jobs") with their latest analysis, newest first.
mailRouter.get('/', async (req, res) => {
    const limit = parseLimit(req.query.limit)
    const cursor = parseCursor(req.query.cursor)

    const messages = await prisma.message.findMany({
        where: { analyses: { some: {} } },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
            chat: true,
            analyses: {
                orderBy: [{ analyzedAt: 'desc' }, { id: 'desc' }],
                take: 1,
                include: { analysisConfig: { select: { name: true } } },
            },
        },
    })

    const page = buildPage(messages, limit)

    res.json({
        items: page.items.flatMap((message) => {
            const analysis = message.analyses[0]
            if (!analysis) return []
            const payload: NotificationPayload = {
                chatTitle: message.chat.title,
                senderName: message.senderName,
                text: message.text,
                receivedAt: message.receivedAt.toISOString(),
                analysisConfigName: analysis.analysisConfig.name,
                analysis: asRecord(analysis.rawResponse),
            }
            return [
                {
                    messageId: message.id,
                    senderName: message.senderName,
                    text: message.text,
                    receivedAt: message.receivedAt.toISOString(),
                    chat: chatRef(message.chat),
                    analysisId: analysis.id,
                    analyzedAt: analysis.analyzedAt.toISOString(),
                    provider: analysis.provider,
                    model: analysis.model,
                    analysisConfigName: analysis.analysisConfig.name,
                    analysis: analysis.rawResponse,
                    body: buildNotificationText(payload),
                },
            ]
        }),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
    })
})

const sendSchema = z.object({
    analysisId: z.string().min(1),
    recipients: z.array(z.string().min(1, 'a recipient address cannot be empty')).min(1, 'at least one recipient is required'),
    subject: z.string().optional(),
    body: z.string().optional(),
    notifierId: z.string().optional(),
})

// POST /mail/send — compose and send an email for an analysed message.
mailRouter.post('/send', async (req, res) => {
    const body = sendSchema.parse(req.body ?? {})

    const analysis = await prisma.analysis.findUnique({
        where: { id: body.analysisId },
        include: { analysisConfig: { select: { name: true } }, message: { include: { chat: true } } },
    })
    if (!analysis) {
        return res.status(404).json({ error: 'analysis not found' })
    }

    let smtp: Extract<ReturnType<typeof resolveSmtp>, { ok: true }> | null = null

    if (body.notifierId) {
        const notifier = await prisma.notifier.findUnique({ where: { id: body.notifierId } })
        if (!notifier) {
            return res.status(404).json({ error: 'notifier not found' })
        }
        if (notifier.type !== 'email') {
            return res.status(400).json({ error: 'notifier must be of type email' })
        }
        const config = typeof notifier.config === 'string' ? decryptJson<Record<string, unknown>>(notifier.config, {}) : {}
        const resolved = resolveSmtp(config)
        if (!resolved.ok) {
            return res.status(400).json({ error: resolved.error })
        }
        smtp = resolved
    } else {
        const notifier = await prisma.notifier.findFirst({
            where: { type: 'email' },
            orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
        })
        if (notifier && typeof notifier.config === 'string') {
            const resolved = resolveSmtp(decryptJson<Record<string, unknown>>(notifier.config, {}))
            if (resolved.ok) smtp = resolved
        }
        if (!smtp) {
            const envOnly = resolveSmtp({})
            if (!envOnly.ok) {
                return res.status(400).json({ error: envOnly.error })
            }
            smtp = envOnly
        }
    }

    const payload: NotificationPayload = {
        chatTitle: analysis.message.chat.title,
        senderName: analysis.message.senderName,
        text: analysis.message.text,
        receivedAt: analysis.message.receivedAt.toISOString(),
        analysisConfigName: analysis.analysisConfig.name,
        analysis: asRecord(analysis.rawResponse),
    }

    const subject =
        body.subject?.trim() ||
        `[${analysis.analysisConfig.name}] Analysed message — ${analysis.message.chat.title}`
    const text = body.body?.trim() || buildNotificationText(payload)

    const result = await sendSmtpMail({
        from: smtp.from,
        connection: smtp.connection,
        to: body.recipients,
        subject,
        text,
    })

    if (result.status === 'failed') {
        return res.status(400).json({ error: result.error ?? 'send failed' })
    }

    res.json({
        ok: true,
        host: smtp.connection.host,
        from: smtp.from,
        to: body.recipients,
        subject,
        sentAt: new Date().toISOString(),
    })
})