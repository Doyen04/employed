import { decryptSecret } from '../../crypto'
import { buildNotificationText } from './format'
import type { Notifier, NotifierResult } from '../types'

const BODY_MAX = 4096

export const telegramNotifier: Notifier = {
    async send(payload, config): Promise<NotifierResult> {
        const target = String((config as { targetChatId?: unknown }).targetChatId ?? '')
        if (!target) {
            return { status: 'failed', error: 'telegram notifier requires config.targetChatId' }
        }

        const blocked = await monitoredChatRefusal(target)
        if (blocked) {
            return { status: 'failed', error: blocked }
        }

        const { tryTelegramClient } = await import('../../telegram/client')
        const client = await tryTelegramClient()
        if (!client) {
            return { status: 'failed', error: 'telegram session not authenticated' }
        }

        try {
            await client.sendMessage(target, { message: buildNotificationText(payload).slice(0, BODY_MAX) })
            return { status: 'sent' }
        } catch (error) {
            return { status: 'failed', error: (error as Error).message }
        }
    },
}

async function monitoredChatRefusal(target: string): Promise<string | null> {
    try {
        const { prisma } = await import('../../prisma')
        const chat = await prisma.chat.findUnique({ where: { telegramChatId: BigInt(target) } })
        if (chat?.isMonitored) {
            return `refusing to send into monitored chat "${chat.title}" — notifications there would re-trigger analysis (infinite loop). Use a non-monitored channel or another chat.`
        }
    } catch {
        // not a tracked chat id — sending is safe (unmonitored chats are ignored by the listener)
    }
    return null
}

export function decryptNotifierConfig(encryptedConfig: unknown): Record<string, unknown> {
    if (typeof encryptedConfig !== 'string') return {}
    try {
        return JSON.parse(decryptSecret(encryptedConfig)) as Record<string, unknown>
    } catch (error) {
        console.error('[notifiers] failed to decrypt notifier config:', error)
        return {}
    }
}