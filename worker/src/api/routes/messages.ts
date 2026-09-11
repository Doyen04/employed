import { Router } from 'express'

import { prisma } from '../../prisma'
import type { Message } from '../../generated/prisma/client'
import { parseLimit, parseCursor, buildPage } from '../../utils/pagination'
import { chatRef } from '../serializers'

export const messagesRouter = Router()

function serializeMessage(message: Message & { chat: { id: string; title: string; telegramChatId: bigint } }) {
    return {
        id: message.id,
        chatId: message.chatId,
        telegramMessageId: message.telegramMessageId,
        senderName: message.senderName,
        text: message.text,
        receivedAt: message.receivedAt.toISOString(),
        chat: chatRef(message.chat),
    }
}

messagesRouter.get('/summary', async (_req, res) => {
    const chats = await prisma.chat.findMany({
        where: { isMonitored: true },
        include: {
            _count: { select: { messages: true } },
            messages: {
                orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
                take: 1,
                select: { text: true, receivedAt: true },
            },
        },
    })

    const rows = chats.map((chat) => ({
        chatId: chat.id,
        title: chat.title,
        telegramChatId: chat.telegramChatId.toString(),
        messageCount: chat._count.messages,
        lastText: chat.messages[0]?.text ?? null,
        lastReceivedAt: chat.messages[0]?.receivedAt.toISOString() ?? null,
    }))

    rows.sort((a, b) => {
        if (a.lastReceivedAt && b.lastReceivedAt) {
            return b.lastReceivedAt.localeCompare(a.lastReceivedAt)
        }
        if (a.lastReceivedAt) return -1
        if (b.lastReceivedAt) return 1
        return a.title.localeCompare(b.title)
    })

    res.json({ items: rows })
})

messagesRouter.get('/', async (req, res) => {
    const limit = parseLimit(req.query.limit)
    const chatId = typeof req.query.chatId === 'string' ? req.query.chatId : undefined
    const cursor = parseCursor(req.query.cursor)

    const messages = await prisma.message.findMany({
        where: chatId ? { chatId } : undefined,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        include: { chat: true },
    })

    const page = buildPage(messages, limit)

    res.json({
        items: page.items.map(serializeMessage),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
    })
})

messagesRouter.delete('/:id', async (req, res) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } })
    if (!message) {
        return res.status(404).json({ error: 'message not found' })
    }

    await prisma.$transaction([
        prisma.actionLog.deleteMany({ where: { analysis: { messageId: req.params.id } } }),
        prisma.analysis.deleteMany({ where: { messageId: req.params.id } }),
        prisma.message.delete({ where: { id: req.params.id } }),
    ])

    res.status(204).end()
})