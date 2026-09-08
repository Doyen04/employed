import { prisma } from '../prisma'
import { requireTelegramClient } from './client'
import { withTimeout } from '../utils/withTimeout'
import { clearDiagnostic, reportDiagnostic } from '../diagnostics'

const REFRESH_TIMEOUT_MS = 20_000

export async function refreshChats(): Promise<number> {
    try {
        const client = await requireTelegramClient()
        const dialogs = await withTimeout(
            client.getDialogs({}),
            REFRESH_TIMEOUT_MS,
            'chat refresh timed out while fetching dialogs',
        )

        let count = 0
        for (const dialog of dialogs) {
            if (dialog.id === undefined || dialog.id === null) continue
            const telegramChatId = BigInt(dialog.id.toString())
            const title = typeof dialog.title === 'string' ? dialog.title : String(telegramChatId)

            await prisma.chat.upsert({
                where: { telegramChatId },
                update: { title },
                create: {
                    telegramChatId,
                    title,
                    isMonitored: false,
                },
            })
            count += 1
        }

        await clearDiagnostic('telegram.scan')
        return count
    } catch (error) {
        const message = (error as Error).message || String(error)
        await reportDiagnostic('telegram.scan', 'error', `Failed to refresh Telegram chats: ${message}`)
        throw error
    }
}