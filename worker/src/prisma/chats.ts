import { prisma } from '../prisma'

export async function findChatByTelegramId(telegramId: string | bigint): Promise<{ id: string; title: string; isMonitored: boolean } | null> {
    try {
        return await prisma.chat.findUnique({
            where: { telegramChatId: typeof telegramId === 'bigint' ? telegramId : BigInt(telegramId) },
            select: { id: true, title: true, isMonitored: true },
        })
    } catch {
        return null
    }
}

export async function getMonitoredChatRefusal(target: string): Promise<string | null> {
    const chat = await findChatByTelegramId(target)
    if (chat?.isMonitored) {
        return `refusing to send into monitored chat "${chat.title}" — notifications there would re-trigger analysis (infinite loop). Use a non-monitored channel or another chat.`
    }
    return null
}
