import { Router } from 'express'

import { prisma } from '../../prisma'
import { parseLimit, parseCursor, buildPage } from '../../utils/pagination'
import { chatRef } from '../serializers'

export const analysesRouter = Router()

analysesRouter.get('/', async (req, res) => {
  const limit = parseLimit(req.query.limit)
  const cursor = parseCursor(req.query.cursor)

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

  const page = buildPage(rows, limit)

  res.json({
    items: page.items.map((row) => ({
      id: row.id,
      analyzedAt: row.analyzedAt.toISOString(),
      rawResponse: row.rawResponse,
      provider: row.provider,
      model: row.model,
      analysisConfigName: row.analysisConfig.name,
      fired: row.actionLogs.length > 0,
      message: {
        id: row.message.id,
        text: row.message.text,
        senderName: row.message.senderName,
        receivedAt: row.message.receivedAt.toISOString(),
        chat: chatRef(row.message.chat),
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
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  })
})