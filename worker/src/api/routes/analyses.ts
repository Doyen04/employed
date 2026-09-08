import { Router } from 'express'

import { prisma } from '../../prisma'

export const analysesRouter = Router()

analysesRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

  const rows = await prisma.analysis.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ analyzedAt: 'desc' }, { id: 'desc' }],
    include: {
      analysisConfig: { select: { name: true } },
      message: { include: { chat: true } },
      actionLogs: {
        orderBy: [{ sentAt: 'asc' }],
        include: { notifier: { select: { id: true, name: true, type: true } } },
      },
    },
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

  res.json({
    items: page.map((row) => ({
      id: row.id,
      analyzedAt: row.analyzedAt.toISOString(),
      rawResponse: row.rawResponse,
      analysisConfigName: row.analysisConfig.name,
      fired: row.actionLogs.length > 0,
      message: {
        id: row.message.id,
        text: row.message.text,
        senderName: row.message.senderName,
        receivedAt: row.message.receivedAt.toISOString(),
        chat: {
          id: row.message.chat.id,
          title: row.message.chat.title,
          telegramChatId: row.message.chat.telegramChatId.toString(),
        },
      },
      actions: row.actionLogs.map((log) => ({
        id: log.id,
        status: log.status,
        retryCount: log.retryCount,
        sentAt: log.sentAt?.toISOString() ?? null,
        errorDetail: log.errorDetail,
        notifier: { id: log.notifier.id, name: log.notifier.name, type: log.notifier.type },
      })),
    })),
    nextCursor,
    hasMore,
  })
})