import { useEffect, useState } from 'react'
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    LogOut,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react'

import {
    getTelegramStatus,
    telegramLoginAbort,
    telegramLoginStart,
    telegramLoginStatus,
    telegramLogout,
    telegramSubmitCode,
    telegramSubmitPassword,
} from '../../server/telegram'
import type { TelegramLoginState } from '../../lib/types'
import { errorText } from '../../lib/utils'

export function TelegramLoginCard({
    loggedIn,
    onDone,
    onDisconnect,
}: {
    loggedIn: boolean
    onDone: () => void
    onDisconnect: () => void
}) {
    const [loginState, setLoginState] = useState<TelegramLoginState>({ state: 'idle' })
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false)
    const [showReauth, setShowReauth] = useState(false)

    const phase = loginState.state

    useEffect(() => {
        if (phase === 'started' || phase === 'awaitingCode' || phase === 'awaitingPassword') {
            const timer = setInterval(() => {
                void refresh()
            }, 2000)
            return () => clearInterval(timer)
        }
    }, [phase])

    async function refresh() {
        try {
            const res = await telegramLoginStatus()
            setLoginState(res.login)
            if (res.login.state === 'done') {
                onDone()
                setShowReauth(false)
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
        setBusy(true)
        try {
            const res = await telegramLoginAbort()
            setLoginState(res.login)
            setShowReauth(false)
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    async function handleDisconnect() {
        setBusy(true)
        setError(null)
        try {
            await telegramLogout()
            onDisconnect()
            setShowConfirmDisconnect(false)
            setLoginState({ state: 'idle' })
            setPhone('')
            setCode('')
            setPassword('')
        } catch (err) {
            setError(errorText(err))
        } finally {
            setBusy(false)
        }
    }

    // Active connected view
    if (loggedIn && !showReauth && phase === 'idle') {
        return (
            <div className="flex flex-col h-full gap-6">
                {/* Connected Card */}
                <div className="relative overflow-hidden rounded-2xl border border-[rgba(236,185,20,0.35)] bg-[rgba(236,185,20,0.07)] p-6 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(236,185,20,0.2)] text-[var(--lagoon-deep)] border border-[rgba(236,185,20,0.3)]">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-[var(--sea-ink)] dark:text-zinc-100 text-lg">
                                        Telegram Connected
                                    </h3>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(236,185,20,0.18)] px-2.5 py-0.5 text-xs font-semibold text-[var(--lagoon-deep)] border border-[rgba(236,185,20,0.28)]">
                                        <span className="h-2 w-2 rounded-full bg-[var(--lagoon)] animate-pulse" />
                                        Active Session
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400">
                                    MTProto session active &amp; encrypted via AES-256-GCM. Realtime message ingestion enabled.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                            <span className="text-[var(--sea-ink-soft)] dark:text-zinc-400 block font-medium">Protocol</span>
                            <span className="font-semibold text-[var(--sea-ink)] dark:text-zinc-200 mt-0.5 block">Teleproto (MTProto Layer 229)</span>
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                            <span className="text-[var(--sea-ink-soft)] dark:text-zinc-400 block font-medium">Listener State</span>
                            <span className="font-semibold text-[var(--lagoon-deep)] dark:text-[var(--lagoon)] mt-0.5 block">Listening for Monitored Chats</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setShowReauth(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-zinc-800 transition"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Switch Account / Re-authenticate
                    </button>

                    {!showConfirmDisconnect ? (
                        <button
                            type="button"
                            onClick={() => setShowConfirmDisconnect(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Disconnect Telegram
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-1.5">
                            <span className="text-xs font-medium text-red-600 dark:text-red-400 px-2">Confirm disconnect?</span>
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                disabled={busy}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                            >
                                {busy ? 'Disconnecting…' : 'Yes, Disconnect'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowConfirmDisconnect(false)}
                                className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)] dark:text-zinc-400 hover:bg-white/40"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Active Login Wizard Stepper Phase calculations
    const stepIndex =
        phase === 'awaitingCode' ? 2 : phase === 'awaitingPassword' ? 3 : 1

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Wizard Header Stepper */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold">
                    {/* Step 1 */}
                    <div
                        className={`flex items-center gap-2 ${stepIndex >= 1 ? 'text-[var(--sea-ink)] dark:text-zinc-100' : 'text-zinc-400'
                            }`}
                    >
                        <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${stepIndex > 1
                                    ? 'bg-[var(--lagoon)] text-[#4F3D35]'
                                    : stepIndex === 1
                                        ? 'bg-[var(--sea-ink)] text-white dark:bg-[var(--lagoon)] dark:text-[#4F3D35]'
                                        : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
                                }`}
                        >
                            {stepIndex > 1 ? <CheckCircle2 className="h-4 w-4" /> : '1'}
                        </div>
                        <span>Phone Number</span>
                    </div>

                    <div className="h-0.5 flex-1 mx-3 bg-[var(--line)]" />

                    {/* Step 2 */}
                    <div
                        className={`flex items-center gap-2 ${stepIndex >= 2 ? 'text-[var(--sea-ink)] dark:text-zinc-100' : 'text-zinc-400'
                            }`}
                    >
                        <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${stepIndex > 2
                                    ? 'bg-[var(--lagoon)] text-[#4F3D35]'
                                    : stepIndex === 2
                                        ? 'bg-[var(--sea-ink)] text-white dark:bg-[var(--lagoon)] dark:text-[#4F3D35]'
                                        : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
                                }`}
                        >
                            {stepIndex > 2 ? <CheckCircle2 className="h-4 w-4" /> : '2'}
                        </div>
                        <span>OTP Code</span>
                    </div>

                    <div className="h-0.5 flex-1 mx-3 bg-[var(--line)]" />

                    {/* Step 3 */}
                    <div
                        className={`flex items-center gap-2 ${stepIndex === 3 ? 'text-[var(--sea-ink)] dark:text-zinc-100' : 'text-zinc-400'
                            }`}
                    >
                        <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${stepIndex === 3
                                    ? 'bg-[var(--sea-ink)] text-white dark:bg-[var(--lagoon)] dark:text-[#4F3D35]'
                                    : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
                                }`}
                        >
                            3
                        </div>
                        <span>2FA Password</span>
                    </div>
                </div>
            </div>

            {/* Success banner if just completed */}
            {phase === 'done' && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(236,185,20,0.35)] bg-[rgba(236,185,20,0.12)] p-4 text-sm text-[var(--lagoon-deep)] dark:text-[var(--lagoon)]">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--lagoon-deep)]" />
                    <div>
                        <p className="font-semibold">Authentication Successful!</p>
                        <p className="text-xs opacity-90">Telegram session saved. The worker is now listening for incoming messages.</p>
                    </div>
                </div>
            )}

            {/* Error alert banner */}
            {error && (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1 text-xs">
                        <p className="font-semibold">Authentication Error</p>
                        <p className="mt-0.5 opacity-90">{error}</p>
                    </div>
                </div>
            )}

            {/* Step Forms */}
            <div className="flex flex-col gap-5 flex-1 justify-center max-w-md mx-auto w-full py-2">
                {/* Waiting for started */}
                {phase === 'started' && (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <RefreshCw className="h-8 w-8 text-[var(--lagoon-deep)] dark:text-[var(--lagoon)] animate-spin" />
                        <p className="text-sm font-medium text-[var(--sea-ink)] dark:text-zinc-200">
                            Connecting to Telegram servers…
                        </p>
                        <p className="text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 max-w-xs">
                            Sending login request for {phone}. Telegram will send an official authentication code to your Telegram app shortly.
                        </p>
                    </div>
                )}

                {/* Step 1: Phone Form */}
                {(phase === 'idle' || phase === 'error') && (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 uppercase tracking-wider mb-2">
                                Telegram Phone Number
                            </label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+15551234567"
                                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-medium outline-none transition focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20 dark:text-zinc-100"
                                />
                            </div>
                            <p className="mt-2 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 leading-relaxed">
                                Include country code prefix (e.g. <code className="px-1.5 py-0.5 rounded bg-[var(--line)] text-xs">+1</code> or <code className="px-1.5 py-0.5 rounded bg-[var(--line)] text-xs">+44</code>). You will receive an official login code in your Telegram app.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleStart}
                                disabled={busy || !phone.trim()}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] dark:bg-[var(--lagoon)] dark:text-[#4F3D35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                            >
                                {busy ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Sending Request…
                                    </>
                                ) : (
                                    <>
                                        Send Login Code
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                            {showReauth && (
                                <button
                                    type="button"
                                    onClick={() => setShowReauth(false)}
                                    className="rounded-xl border border-[var(--line)] px-4 py-3 text-xs font-semibold text-[var(--sea-ink-soft)] hover:bg-white/50"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Verification Code */}
                {phase === 'awaitingCode' && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl bg-[rgba(236,185,20,0.12)] border border-[rgba(236,185,20,0.25)] p-3.5 text-xs text-[var(--sea-ink)] dark:text-zinc-200">
                            <p className="font-semibold">Code sent to Telegram!</p>
                            <p className="mt-0.5 text-[var(--sea-ink-soft)] dark:text-zinc-400">
                                Check your active Telegram session on your phone or computer.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 uppercase tracking-wider mb-2">
                                5-Digit Telegram Code
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="12345"
                                autoFocus
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-lg font-mono tracking-widest outline-none transition focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20 dark:text-zinc-100"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSubmitCode}
                                disabled={busy || !code.trim()}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] dark:bg-[var(--lagoon)] dark:text-[#4F3D35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                            >
                                {busy ? 'Verifying Code…' : 'Submit Code'}
                            </button>
                            <button
                                type="button"
                                onClick={handleAbort}
                                disabled={busy}
                                className="rounded-xl border border-[var(--line)] px-4 py-3 text-xs font-semibold text-[var(--sea-ink-soft)] dark:text-zinc-400 hover:bg-white/50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: 2FA Password */}
                {phase === 'awaitingPassword' && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                            <p className="font-semibold">Two-Step Verification Required</p>
                            {'hint' in loginState && loginState.hint ? (
                                <p className="mt-0.5">Password hint: <code className="font-mono bg-amber-500/20 px-1 rounded">{loginState.hint}</code></p>
                            ) : (
                                <p className="mt-0.5">Your Telegram account is protected with a 2FA cloud password.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 uppercase tracking-wider mb-2">
                                2FA Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoFocus
                                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/20 dark:text-zinc-100"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSubmitPassword}
                                disabled={busy || !password.trim()}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] dark:bg-[var(--lagoon)] dark:text-[#4F3D35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                            >
                                {busy ? 'Authenticating…' : 'Submit Password'}
                            </button>
                            <button
                                type="button"
                                onClick={handleAbort}
                                disabled={busy}
                                className="rounded-xl border border-[var(--line)] px-4 py-3 text-xs font-semibold text-[var(--sea-ink-soft)] dark:text-zinc-400 hover:bg-white/50"
                            >
                                Cancel
                            </button>
                        </div>
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

    return {
        loggedIn,
        onDone: () => setLoggedIn(true),
        onDisconnect: () => setLoggedIn(false),
    }
}