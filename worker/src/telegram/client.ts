import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'

import { config } from '../config'
import { getSessionString } from './sessionStore'

export function buildClient(session: string): TelegramClient {
  return new TelegramClient(
    new StringSession(session),
    Number(config.TELEGRAM_API_ID ?? 0),
    config.TELEGRAM_API_HASH ?? '',
    { connectionRetries: 5 },
  )
}

let client: TelegramClient | null = null

export function getCachedClient(): TelegramClient | null {
  return client
}

export async function requireTelegramClient(): Promise<TelegramClient> {
  if (client) return client

  const session = await getSessionString()
  if (!session) {
    throw new Error('Telegram session not authenticated — run `npm run login` first')
  }

  client = buildClient(session)
  await client.connect()
  return client
}

export async function tryTelegramClient(): Promise<TelegramClient | null> {
  try {
    return await requireTelegramClient()
  } catch (error) {
    console.error('[telegram] client unavailable:', (error as Error).message)
    return null
  }
}