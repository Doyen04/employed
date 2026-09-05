import { Router } from 'express'

import { prisma } from '../../prisma'

export const actionLogsRouter = Router()

actionLogsRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

  const rows = await prisma.actionLog.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
    include: {
      notifier: true,
      analysis: { include: { message: { include: { chat: true } }, analysisConfig: true } },
    },
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

  res.json({
    items: page.map((row) => ({
      id: row.id,
      status: row.status,
      retryCount: row.retryCount,
      sentAt: row.sentAt?.toISOString() ?? null,
      errorDetail: row.errorDetail,
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
          chat: {
            id: row.analysis.message.chat.id,
            title: row.analysis.message.chat.title,
            telegramChatId: row.analysis.message.chat.telegramChatId.toString(),
          },
        },
      },
    })),
    nextCursor,
    hasMore,
  })
})