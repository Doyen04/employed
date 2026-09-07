import { useEffect, useState } from 'react'

import {
    getTelegramStatus,
    telegramLoginAbort,
    telegramLoginStart,
    telegramLoginStatus,
    telegramSubmitCode,
    telegramSubmitPassword,
} from '../../server/telegram'
import type { TelegramLoginState } from '../../lib/types'
import { errorText } from '../../lib/utils'

export function TelegramLoginCard({
    loggedIn,
    onDone,
}: {
    loggedIn: boolean
    onDone: () => void
}) {
    const [loginState, setLoginState] = useState<TelegramLoginState>({ state: 'idle' })
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const phase = loginState.state

    useEffect(() => {
        if (phase === 'started' || phase === 'awaitingCode' || phase === 'awaitingPassword') {
            const timer = setInterval(() => {
                void refresh()
            }, 2000)
            return () => clearInterval(timer)
        }
    }, [phase, refresh])

    async function refresh() {
        try {
            const res = await telegramLoginStatus()
            setLoginState(res.login)
            if (res.login.state === 'done') {
                onDone()
            } else if (res.login.state === 'error') {
                setError(res.login.error)
            }
        } catch (err) {
            setError(errorText(err))
        }
    }

    async function handleStart() {
        setBusy(true)
        setError(null)
        try {
            const res = await telegramLoginStart({ data: { phoneNumber: phone } })
            setLoginState(res.login)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function handleSubmitCode() {
        setBusy(true)
        setError(null)
        try {
            const res = await telegramSubmitCode({ data: { code } })
            setLoginState(res.login)
            if (res.login.state === 'error') setError(res.login.error)
            setCode('')
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function handleSubmitPassword() {
        setBusy(true)
        setError(null)
        try {
            const res = await telegramSubmitPassword({ data: { password } })
            setLoginState(res.login)
            if (res.login.state === 'error') setError(res.login.error)
            setPassword('')
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function handleAbort() {
        try {
            const res = await telegramLoginAbort()
            setLoginState(res.login)
        } catch (err) {
            setError(errorText(err))
        }
    }

    return (
        <div className="flex h-full flex-col">
            <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
                {loggedIn && phase !== 'idle'
                    ? 'You are connected. The flow below can replace the session.'
                    : loggedIn
                        ? 'The worker is authenticated with a saved session.'
                        : 'Authenticate the worker so it can listen for incoming messages.'}
            </p>

            {phase === 'done' && (
                <p className="mb-4 rounded-xl border border-[rgba(79,184,178,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)]">
                    Session saved — realtime listener started.
                </p>
            )}

            {phase === 'error' && (
                <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                    {error ?? ('error' in loginState ? loginState.error : '')}
                </p>
            )}

            <div className="mt-auto flex flex-col gap-3">
                {phase === 'started' && (
                    <p className="text-sm text-[var(--sea-ink-soft)]">
                        Starting… waiting for Telegram to request a code.
                    </p>
                )}

                {phase === 'awaitingCode' && (
                    <div className="flex flex-col gap-2">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--sea-ink)]">
                            Code from Telegram
                            <input
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="12345"
                                autoFocus
                                className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5 font-normal outline-none transition focus:border-[rgba(50,143,151,0.6)]"
                            />
                        </label>
                        <button
                            onClick={handleSubmitCode}
                            disabled={busy || !code}
                            className="rounded-full bg-[linear-gradient(90deg,#2f9e92,#56c6be)] px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                        >
                            {busy ? '…' : 'Submit code'}
                        </button>
                    </div>
                )}

                {phase === 'awaitingPassword' && (
                    <div className="flex flex-col gap-2">
                        {'hint' in loginState && loginState.hint ? (
                            <p className="text-sm text-[var(--sea-ink-soft)]">2FA hint: {loginState.hint}</p>
                        ) : null}
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--sea-ink)]">
                            2FA password
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="••••••••"
                                autoFocus
                                className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5 font-normal outline-none transition focus:border-[rgba(50,143,151,0.6)]"
                            />
                        </label>
                        <button
                            onClick={handleSubmitPassword}
                            disabled={busy || !password}
                            className="rounded-full bg-[linear-gradient(90deg,#2f9e92,#56c6be)] px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                        >
                            {busy ? '…' : 'Submit password'}
                        </button>
                    </div>
                )}

                {phase === 'started' ||
                    phase === 'awaitingCode' ||
                    phase === 'awaitingPassword' ? (
                    <button
                        onClick={handleAbort}
                        className="rounded-full border border-[rgba(190,120,60,0.4)] bg-[rgba(190,120,60,0.1)] px-5 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[rgba(190,120,60,0.2)]"
                    >
                        Cancel login
                    </button>
                ) : (
                    <div className="flex flex-col gap-2">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--sea-ink)]">
                            Phone number
                            <input
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                placeholder="+15551234567"
                                className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5 font-normal outline-none transition focus:border-[rgba(50,143,151,0.6)]"
                            />
                        </label>
                        <button
                            onClick={handleStart}
                            disabled={busy || !phone}
                            className="rounded-full bg-[linear-gradient(90deg,#2f9e92,#56c6be)] px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                        >
                            {busy ? '…' : 'Start Telegram login'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export function useTelegramLoggedIn() {
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {
        let alive = true
        async function load() {
            try {
                const status = await getTelegramStatus()
                if (alive) setLoggedIn(status.loggedIn)
            } catch {
                // worker unreachable — leave as not logged in
            }
        }
        void load()
        return () => {
            alive = false
        }
    }, [])

    return { loggedIn, onDone: () => setLoggedIn(true) }
}