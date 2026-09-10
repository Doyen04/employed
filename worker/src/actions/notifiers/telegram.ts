import { decryptJson } from '../../utils/json'
import { getMonitoredChatRefusal } from '../../prisma/chats'
import { buildNotificationText } from './format'
import type { Notifier, NotifierResult } from '../types'

const BODY_MAX = 4096

export const telegramNotifier: Notifier = {
    async send(payload, config): Promise<NotifierResult> {
        const target = String((config as { targetChatId?: unknown }).targetChatId ?? '')
        if (!target) {
            return { status: 'failed', error: 'telegram notifier requires config.targetChatId' }
        }

        const blocked = await getMonitoredChatRefusal(target)
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

export function decryptNotifierConfig(encryptedConfig: unknown): Record<string, unknown> {
    if (typeof encryptedConfig !== 'string') return {}
    return decryptJson(encryptedConfig, {})
}