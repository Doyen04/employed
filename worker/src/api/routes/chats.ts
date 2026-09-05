import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../../prisma'
import type { Chat } from '../../generated/prisma/client'

export const chatsRouter = Router()

function serializeChat(chat: Chat) {
    return {
        id: chat.id,
        telegramChatId: chat.telegramChatId.toString(),
        title: chat.title,
        isMonitored: chat.isMonitored,
        addedAt: chat.addedAt.toISOString(),
    }
}

const patchSchema = z
    .object({
        title: z.string().optional(),
        isMonitored: z.boolean().optional(),
    })
    .refine((v) => v.title !== undefined || v.isMonitored !== undefined, {
        message: 'provide at least one of title or isMonitored',
    })

chatsRouter.get('/', async (_req, res) => {
    const chats = await prisma.chat.findMany({
        orderBy: { addedAt: 'desc' },
    })
    res.json({ items: chats.map(serializeChat) })
})

chatsRouter.patch('/:id', async (req, res) => {
    const body = patchSchema.parse(req.body ?? {})
    const chat = await prisma.chat.update({
        where: { id: req.params.id },
        data: body,
    })
    res.json(serializeChat(chat))
})

chatsRouter.post('/refresh', async (_req, res) => {
    try {
        const { refreshChats } = await import('../../telegram/scan')
        const count = await refreshChats()
        res.json({ ok: true, chats: count })
    } catch (error) {
        res.status(400).json({ error: (error as Error).message })
    }
})