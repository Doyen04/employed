import { Router } from 'express'

import { prisma } from '../../prisma'
import type { Message } from '../../generated/prisma/client'

export const messagesRouter = Router()

function serializeMessage(message: Message & { chat: { id: string; title: string; telegramChatId: bigint } }) {
    return {
        id: message.id,
        chatId: message.chatId,
        telegramMessageId: message.telegramMessageId,
        senderName: message.senderName,
        text: message.text,
        receivedAt: message.receivedAt.toISOString(),
        chat: {
            id: message.chat.id,
            title: message.chat.title,
            telegramChatId: message.chat.telegramChatId.toString(),
        },
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
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200)
    const chatId = typeof req.query.chatId === 'string' ? req.query.chatId : undefined
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined

    const messages = await prisma.message.findMany({
        where: chatId ? { chatId } : undefined,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        include: { chat: true },
    })

    const hasMore = messages.length > limit
    const page = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

    res.json({
        items: page.map(serializeMessage),
        nextCursor,
        hasMore,
    })
})