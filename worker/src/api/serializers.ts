import type { Chat } from '../generated/prisma/client'

export function chatRef(chat: Pick<Chat, 'id' | 'title' | 'telegramChatId'>) {
    return {
        id: chat.id,
        title: chat.title,
        telegramChatId: chat.telegramChatId.toString(),
    }
}
