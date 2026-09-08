import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'
import { UnauthorizedError } from 'teleproto/errors'

import { config } from '../config'
import { getSessionString } from './sessionStore'
import { withTimeout } from '../utils/withTimeout'

const CONNECT_TIMEOUT_MS = 20_000

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

    const candidate = buildClient(session)
    try {
        await withTimeout(candidate.connect(), CONNECT_TIMEOUT_MS, 'telegram connection timed out')
        await withTimeout(candidate.getMe(), CONNECT_TIMEOUT_MS, 'telegram session check timed out')
    } catch (error) {
        candidate.disconnect().catch(() => { })
        if (error instanceof UnauthorizedError) {
            throw new Error('Telegram session is invalid or has been revoked — re-login required')
        }
        throw error
    }

    client = candidate
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

export function resetTelegramClient(): void {
    if (!client) return
    const oldClient = client
    client = null
    oldClient.disconnect().catch(() => { })
}