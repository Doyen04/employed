import type { TelegramClient } from 'teleproto'
import type { StringSession } from 'teleproto/sessions'
import { UnauthorizedError } from 'teleproto/errors'

import { getSessionString } from './sessionStore'
import { withTimeout } from '../utils/withTimeout'
import { clearDiagnostic, reportDiagnostic } from '../diagnostics'
import { createClient } from './factory'
import { getErrorMessage } from '../utils/errors'

const CONNECT_TIMEOUT_MS = 20_000

export { createClient } from './factory'

let client: TelegramClient<StringSession> | null = null

export function getCachedClient(): TelegramClient<StringSession> | null {
    return client
}

export async function requireTelegramClient(): Promise<TelegramClient<StringSession>> {
    if (client) return client

    const session = await getSessionString()
    if (!session) {
        await reportDiagnostic(
            'telegram.session',
            'warning',
            'Telegram session not authenticated — sign in via the Telegram settings page or `npm run login`.',
        )
        throw new Error('Telegram session not authenticated — run `npm run login` first')
    }

    const candidate = createClient(session)
    try {
        await withTimeout(candidate.connect(), CONNECT_TIMEOUT_MS, 'telegram connection timed out')
        await withTimeout(candidate.getMe(), CONNECT_TIMEOUT_MS, 'telegram session check timed out')
        await clearDiagnostic('telegram.session')
    } catch (error) {
        candidate.disconnect().catch(() => { })
        if (error instanceof UnauthorizedError) {
            await reportDiagnostic(
                'telegram.session',
                'error',
                'Telegram session is invalid or has been revoked — re-login required.',
            )
            throw new Error('Telegram session is invalid or has been revoked — re-login required')
        }
        if (getErrorMessage(error) === 'telegram connection timed out' || getErrorMessage(error) === 'telegram session check timed out') {
            await reportDiagnostic(
                'telegram.listener',
                'warning',
                'Telegram connection is slow or unreachable — actions may be delayed.',
            )
        }
        throw error
    }

    client = candidate
    return client
}

export async function tryTelegramClient(): Promise<TelegramClient<StringSession> | null> {
    try {
        return await requireTelegramClient()
    } catch (error) {
        console.error('[telegram] client unavailable:', getErrorMessage(error))
        return null
    }
}

export function resetTelegramClient(): void {
    if (!client) return
    const oldClient = client
    client = null
    oldClient.disconnect().catch(() => { })
}