import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'

import { config } from '../config'
import { setSessionString } from './sessionStore'
import { resetTelegramClient } from './client'
import { startTelegramListener } from './listener'

export type TelegramLoginStatus =
    | { state: 'idle' }
    | { state: 'started' }
    | { state: 'awaitingCode' }
    | { state: 'awaitingPassword'; hint?: string }
    | { state: 'done' }
    | { state: 'error'; error: string }

const PROMPT_TIMEOUT_MS = 5 * 60 * 1000

class TelegramLoginFlow {
    private status: TelegramLoginStatus = { state: 'idle' }
    private client: TelegramClient<StringSession> | null = null
    private promptResolve: ((value: string) => void) | null = null
    private promptReject: ((error: Error) => void) | null = null
    private promptTimer: ReturnType<typeof setTimeout> | null = null

    getStatus(): TelegramLoginStatus {
        return this.status
    }

    isActive(): boolean {
        return (
            this.status.state === 'started' ||
            this.status.state === 'awaitingCode' ||
            this.status.state === 'awaitingPassword'
        )
    }

    start(phone: string): TelegramLoginStatus {
        if (this.isActive()) {
            throw new Error(`login already in progress (state: ${this.status.state})`)
        }
        if (!config.TELEGRAM_API_ID || !config.TELEGRAM_API_HASH) {
            throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required in worker/.env')
        }

        this.status = { state: 'started' }
        void this.run(phone)
        return this.status
    }

    submit(kind: 'code' | 'password', value: string): boolean {
        if (!this.promptResolve) return false

        const expected = this.status.state === 'awaitingPassword' ? 'password' : 'code'
        if (expected !== kind) return false

        const resolve = this.promptResolve
        this.clearPrompt()
        resolve(value)
        return true
    }

    async abort(): Promise<TelegramLoginStatus> {
        this.fail('login aborted')
        return this.status
    }

    private async run(phone: string): Promise<void> {
        this.client = new TelegramClient(
            new StringSession(''),
            Number(config.TELEGRAM_API_ID),
            config.TELEGRAM_API_HASH ?? '',
            { connectionRetries: 5 },
        )

        try {
            await this.client.start({
                phoneNumber: phone,
                phoneCode: async () => this.waitForPrompt('code'),
                password: async (hint) => this.waitForPrompt('password', hint),
                onError: async (error) => {
                    this.status = { state: 'error', error: error.message }
                    throw error
                },
            })

            const session = this.client.session.save()
            await setSessionString(session)
            resetTelegramClient()
            this.status = { state: 'done' }
        } catch (error) {
            if (this.status.state !== 'error') {
                this.status = { state: 'error', error: (error as Error).message }
            }
        } finally {
            this.clearPrompt()
            const client = this.client
            this.client = null
            if (client) {
                try {
                    await client.disconnect()
                } catch {
                    // ignore disconnect errors during cleanup
                }
            }
        }

        if (this.status.state === 'done') {
            startTelegramListener().catch((error) =>
                console.error('[authFlow] failed to start telegram listener:', (error as Error).message),
            )
        }
    }

    private waitForPrompt(kind: 'code' | 'password', hint?: string): Promise<string> {
        this.clearPrompt()
        this.status =
            kind === 'password'
                ? hint
                    ? { state: 'awaitingPassword', hint }
                    : { state: 'awaitingPassword' }
                : { state: 'awaitingCode' }

        return new Promise<string>((resolve, reject) => {
            this.promptResolve = resolve
            this.promptReject = reject
            this.promptTimer = setTimeout(() => this.fail('login timed out'), PROMPT_TIMEOUT_MS)
        })
    }

    private fail(message: string): void {
        this.status = { state: 'error', error: message }
        if (this.promptReject) {
            const reject = this.promptReject
            this.clearPrompt()
            reject(new Error(message))
            return
        }
        this.clearPrompt()
        this.client?.disconnect().catch(() => { })
    }

    private clearPrompt(): void {
        if (this.promptTimer) {
            clearTimeout(this.promptTimer)
            this.promptTimer = null
        }
        this.promptResolve = null
        this.promptReject = null
    }
}

export const telegramLogin = new TelegramLoginFlow()