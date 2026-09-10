import { Router } from 'express'

import { prisma } from '../../prisma'
import { parseLimit, parseCursor, buildPage } from '../../utils/pagination'
import { chatRef } from '../serializers'

export const actionLogsRouter = Router()

actionLogsRouter.get('/', async (req, res) => {
    const limit = parseLimit(req.query.limit)
    const cursor = parseCursor(req.query.cursor)

    const rows = await prisma.actionLog.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        include: {
            notifier: true,
            analysis: { include: { message: { include: { chat: true } }, analysisConfig: true } },
        },
    })

    const page = buildPage(rows, limit)

    res.json({
        items: page.items.map((row) => ({
            id: row.id,
            status: row.status,
            retryCount: row.retryCount,
            sentAt: row.sentAt?.toISOString() ?? null,
            errorDetail: row.errorDetail,
            body: row.body,
            recipient: row.recipient,
            notifier: { id: row.notifier.id, name: row.notifier.name, type: row.notifier.type },
            analysis: {
                id: row.analysis.id,
                analyzedAt: row.analysis.analyzedAt.toISOString(),
                rawResponse: row.analysis.rawResponse,
                analysisConfigName: row.analysis.analysisConfig.name,
                message: {
                    id: row.analysis.message.id,
                    text: row.analysis.message.text,
                    senderName: row.analysis.message.senderName,
                    receivedAt: row.analysis.message.receivedAt.toISOString(),
                    chat: chatRef(row.analysis.message.chat),
                },
            },
        })),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
    })
})