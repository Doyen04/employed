import { decryptSecret } from '../crypto'
import type { Notifier, NotifierResult, NotificationPayload } from '../types'

const BODY_MAX = 4096

function buildBody(payload: NotificationPayload): string {
  const fields = Object.entries(payload.analysis)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')

  const text = payload.text.length > 500 ? `${payload.text.slice(0, 500)}…` : payload.text

  const body = [
    `[${payload.analysisConfigName}]`,
    `Chat: ${payload.chatTitle}`,
    `Sender: ${payload.senderName ?? 'unknown'}`,
    `Message: ${text}`,
    fields ? `\n${fields}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return body.slice(0, BODY_MAX)
}

export const telegramNotifier: Notifier = {
  async send(payload, config): Promise<NotifierResult> {
    const target = String((config as { targetChatId?: unknown }).targetChatId ?? '')
    if (!target) {
      return { status: 'failed', error: 'telegram notifier requires config.targetChatId' }
    }

    const { tryTelegramClient } = await import('../../telegram/client')
    const client = await tryTelegramClient()
    if (!client) {
      return { status: 'failed', error: 'telegram session not authenticated' }
    }

    try {
      await client.sendMessage(target, { message: buildBody(payload) })
      return { status: 'sent' }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  },
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