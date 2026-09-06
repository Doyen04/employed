import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import {
    getTelegramStatus,
    telegramLoginAbort,
    telegramLoginStart,
    telegramLoginStatus,
    telegramSubmitCode,
    telegramSubmitPassword,
} from '../../server/telegram'
import { listChats, refreshChats, updateChat } from '../../server/chats'
import { logout } from '../../server/auth'
import { useLiveMessageNew } from '../../client/useRealtime'
import type {
    RealtimeMessageNew,
    TelegramLoginState,
    WorkerChat,
    WorkerTelegramStatus,
} from '../../lib/types'

export const Route = createFileRoute('/_protected/')({ component: Dashboard })

function errorText(error: unknown): string {
    if (error instanceof Error) {
        return error.message.replace(/^UNHANDLED_ERROR:\s*/i, '')
    }
    return String(error)
}

function Dashboard() {
    const [status, setStatus] = useState<WorkerTelegramStatus | null>(null)
    const [statusError, setStatusError] = useState<string | null>(null)
    const [chats, setChats] = useState<WorkerChat[]>([])
    const [chatsError, setChatsError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    async function loadStatus() {
        try {
            setStatus(await getTelegramStatus())
            setStatusError(null)
        } catch (error) {
            setStatusError(errorText(error))
        }
    }

    async function loadChats() {
        try {
            const { items } = await listChats()
            setChats(items)
            setChatsError(null)
        } catch (error) {
            setChatsError(errorText(error))
        }
    }

    useEffect(() => {
        void loadStatus()
        void loadChats()
    }, [])

    async function handleRefreshChats() {
        setRefreshing(true)
        try {
            await refreshChats()
            await loadChats()
        } catch (error) {
            setChatsError(errorText(error))
        } finally {
            setRefreshing(false)
        }
    }

    async function handleToggleMonitor(chat: WorkerChat) {
        try {
            await updateChat({ data: { id: chat.id, isMonitored: !chat.isMonitored } })
            await loadChats()
        } catch (error) {
            setChatsError(errorText(error))
        }
    }

    async function handleLogout() {
        await logout()
        window.location.assign('/login')
    }

    return (
        <main className="page-wrap px-4 pb-8 pt-10">
            <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-10">
                <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
                <p className="island-kicker mb-2">Employed</p>
                <h1 className="display-title mb-1 text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
                    Dashboard
                </h1>
                <p className="mb-6 max-w-2xl text-sm text-[var(--sea-ink-soft)] sm:text-base">
                    Monitor Telegram chats, trigger LLM analysis, and fire actions — everything runs on the
                    worker, this UI talks to it over its private API.
                </p>
                <div className="flex flex-wrap gap-3">
                    <span
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${status?.loggedIn
                                ? 'border-[rgba(79,184,178,0.3)] bg-[rgba(79,184,178,0.14)] text-[var(--lagoon-deep)]'
                                : 'border-[rgba(190,120,60,0.35)] bg-[rgba(190,120,60,0.12)] text-[var(--sea-ink)]'
                            }`}
                    >
                        {status === null ? '…' : status.loggedIn ? 'Telegram connected' : 'Telegram not connected'}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(23,58,64,0.35)]"
                    >
                        Sign out
                    </button>
                </div>
                {statusError && <p className="mt-4 text-sm text-red-500">{statusError}</p>}
            </section>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className="island-shell rounded-2xl p-6">
                    <TelegramLoginCard loggedIn={status?.loggedIn ?? false} onDone={loadStatus} />
                </section>

                <section className="island-shell rounded-2xl p-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">Chats</h2>
                        <button
                            onClick={handleRefreshChats}
                            disabled={refreshing}
                            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-4 py-1.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(23,58,64,0.35)] disabled:opacity-50"
                        >
                            {refreshing ? 'Refreshing…' : 'Refresh from Telegram'}
                        </button>
                    </div>

                    {chatsError && <p className="mb-3 text-sm text-red-500">{chatsError}</p>}

                    {chats.length === 0 ? (
                        <p className="text-sm text-[var(--sea-ink-soft)]">
                            No chats yet — press “Refresh from Telegram” to pull the account’s dialogs.
                        </p>
                    ) : (
                        <ul className="m-0 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                            {chats.map((chat) => (
                                <li
                                    key={chat.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                                            {chat.title}
                                        </p>
                                        <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                                            {chat.telegramChatId}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => void handleToggleMonitor(chat)}
                                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${chat.isMonitored
                                                ? 'bg-[rgba(79,184,178,0.18)] text-[var(--lagoon-deep)]'
                                                : 'bg-[rgba(23,58,64,0.08)] text-[var(--sea-ink-soft)]'
                                            }`}
                                    >
                                        {chat.isMonitored ? 'Monitoring' : 'Paused'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="island-shell mt-4 rounded-2xl p-6">
                <h2 className="mb-2 text-lg font-semibold text-[var(--sea-ink)]">Live analysis</h2>
                <LiveFeed />
            </section>
        </main>
    )
}

function LiveFeed() {
    const events = useLiveMessageNew<RealtimeMessageNew>()

    if (events.length === 0) {
        return (
            <p className="text-sm text-[var(--sea-ink-soft)]">
                Waiting for analyzed messages… (connect the socket via the VITE_WORKER_SOCKET_* envs)
            </p>
        )
    }

    return (
        <ul className="m-0 flex flex-col gap-2">
            {events.map((event, index) => (
                <li
                    key={index}
                    className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
                >
                    <p className="m-0 text-sm text-[var(--sea-ink)]">
                        <span className="font-semibold">{event.chat.title}</span>
                        <span className="text-[var(--sea-ink-soft)]"> · {event.analysisConfigName}</span>
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">{event.message.text}</p>
                </li>
            ))}
        </ul>
    )
}

function TelegramLoginCard({
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
            <h2 className="mb-1 text-lg font-semibold text-[var(--sea-ink)]">Telegram session</h2>
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