import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Inbox, MessageSquare, Radio, RefreshCw, Search, Zap } from 'lucide-react'

import { listMessages, messageSummary } from '../../server/messages'
import { getTelegramStatus } from '../../server/telegram'
import { connectRealtime } from '../../client/socket'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { RealtimeMessageStored, WorkerMessage, WorkerMessageSummary } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/messages')({ component: MessagesPage })

const PAGE_SIZE = 50
const MAX_ITEMS = 200

function MessagesPage() {
    const [summaries, setSummaries] = useState<WorkerMessageSummary[]>([])
    const [chatId, setChatId] = useState<string | undefined>(undefined)
    const [items, setItems] = useState<WorkerMessage[]>([])
    const [newHeads, setNewHeads] = useState<string[]>([])
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const threadRef = useRef<HTMLDivElement>(null)

    async function load(reset: boolean) {
        if (reset) setLoading(true)
        setError(null)
        try {
            const result = await listMessages({
                data: {
                    chatId,
                    limit: PAGE_SIZE,
                    cursor: reset ? undefined : (cursor ?? undefined),
                },
            })
            setItems((previous) => {
                const next = (reset ? result.items : [...previous, ...result.items]).slice(0, MAX_ITEMS)
                const seen = new Set<string>()
                return next.filter((message) => {
                    if (seen.has(message.id)) return false
                    seen.add(message.id)
                    return true
                })
            })
            setCursor(result.nextCursor)
            setHasMore(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset) setLoading(false)
        }
    }

    const flashNew = useCallback((id: string) => {
        setNewHeads((previous) => (previous.includes(id) ? previous : [...previous, id]))
        window.setTimeout(() => {
            setNewHeads((previous) => previous.filter((item) => item !== id))
        }, 2500)
    }, [])

    useEffect(() => {
        let alive = true
        async function init() {
            const [sumRes, statusRes] = await Promise.allSettled([
                messageSummary(),
                getTelegramStatus(),
            ])
            if (!alive) return
            if (sumRes.status === 'fulfilled') setSummaries(sumRes.value)
            if (statusRes.status === 'fulfilled') setTelegramLoggedIn(statusRes.value.loggedIn)
            setLoading(false)
        }
        void init()
        void load(true)
        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        void load(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId])

    useEffect(() => {
        if (threadRef.current) threadRef.current.scrollTop = 0
    }, [chatId])

    useEffect(() => {
        const unsubscribe = connectRealtime({
            onMessageStored: (payload) => {
                const event = payload as RealtimeMessageStored
                const matches = !chatId || event.message.chatId === chatId
                if (matches) {
                    setItems((previous) => {
                        if (previous.some((message) => message.id === event.message.id)) return previous
                        return [event.message, ...previous].slice(0, MAX_ITEMS)
                    })
                    flashNew(event.message.id)
                }
                setSummaries((current) =>
                    current.map((row) =>
                        row.chatId === event.message.chatId
                            ? {
                                  ...row,
                                  lastText: event.message.text,
                                  lastReceivedAt: event.message.receivedAt,
                                  messageCount: row.messageCount + 1,
                              }
                            : row,
                    ),
                )
            },
        })
        return unsubscribe
    }, [chatId, flashNew])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return summaries
        return summaries.filter(
            (row) =>
                row.title.toLowerCase().includes(q) || row.telegramChatId.includes(q),
        )
    }, [summaries, query])

    const selectedChat = summaries.find((row) => row.chatId === chatId)
    const totalMessages = summaries.reduce((sum, row) => sum + row.messageCount, 0)

    if (loading) return <PageSkeleton label="Loading messages" />

    return (
        <section className="island-shell overflow-hidden rounded-2xl p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
                <div>
                    <h2 className="m-0 text-base font-semibold text-[var(--sea-ink)]">Messages</h2>
                    <p className="m-0 mt-0.5 text-sm text-[var(--sea-ink-soft)]">
                        Every message from your monitored chats — pick one on the left to focus its thread.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        Live
                    </span>
                    <button
                        onClick={() => void load(true)}
                        disabled={loading}
                        className="app-primary-button disabled:cursor-wait disabled:opacity-50"
                    >
                        <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {error && <p className="border-b border-[var(--line)] px-5 py-2 text-sm text-red-500">{error}</p>}

            {!telegramLoggedIn ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)]">
                        <Radio className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                        Telegram Disconnected
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400">
                        Your Telegram session is not connected. Connect your account to import and monitor your groups, channels, and chats.
                    </p>
                    <Link
                        to="/telegram"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-[var(--lagoon)] dark:text-[#4F3D35]"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Connect Telegram Account
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            ) : summaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)]">
                        <Inbox className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                        No Monitored Chats
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400">
                        Mark chats as "Monitored" on the Chats page to start persisting their messages here.
                    </p>
                </div>
            ) : (
                <div className="lg:grid lg:h-[min(42rem,calc(100vh-15rem))] lg:grid-cols-[18rem_minmax(0,1fr)] lg:overflow-hidden">
                    <aside className="hidden min-h-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] lg:flex">
                        <div className="relative border-b border-[var(--line)] p-3">
                            <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sea-ink-soft)]" aria-hidden="true" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search chats…"
                                aria-label="Search chats"
                                className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-strong)] py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[var(--lagoon)] dark:text-zinc-100"
                            />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                            <button
                                type="button"
                                onClick={() => setChatId(undefined)}
                                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                    chatId === undefined
                                        ? 'bg-[rgba(236,185,20,0.14)] ring-1 ring-[rgba(236,185,20,0.4)]'
                                        : 'hover:bg-[var(--surface-strong)]'
                                }`}
                            >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(236,185,20,0.18)] text-[var(--lagoon-deep)] dark:text-[var(--lagoon)]">
                                    <Inbox className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-[var(--sea-ink)] dark:text-zinc-100">
                                        Inbox
                                    </span>
                                    <span className="block truncate text-xs text-[var(--sea-ink-soft)]">
                                        {totalMessages.toLocaleString()} messages
                                    </span>
                                </span>
                            </button>

                            {filtered.length === 0 && (
                                <p className="px-2.5 py-6 text-center text-xs text-[var(--sea-ink-soft)]">
                                    No chats match {query ? `"${query}"` : ''}.
                                </p>
                            )}

                            {filtered.map((row) => {
                                const active = chatId === row.chatId
                                return (
                                    <button
                                        key={row.chatId}
                                        type="button"
                                        onClick={() => setChatId(row.chatId)}
                                        className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                            active
                                                ? 'bg-[rgba(236,185,20,0.14)] ring-1 ring-[rgba(236,185,20,0.4)]'
                                                : 'hover:bg-[var(--surface-strong)]'
                                        }`}
                                    >
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(236,185,20,0.18)] text-xs font-bold text-[var(--lagoon-deep)] dark:text-[var(--lagoon)]">
                                            {initials(row.title)}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={`block truncate text-sm ${
                                                    active
                                                        ? 'font-semibold text-[var(--sea-ink)] dark:text-zinc-100'
                                                        : 'font-medium text-[var(--sea-ink)] dark:text-zinc-200'
                                                }`}
                                            >
                                                {row.title}
                                            </span>
                                            <span className="block truncate text-xs text-[var(--sea-ink-soft)]">
                                                {row.lastText ?? 'No messages yet'}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="text-[10px] text-[var(--sea-ink-soft)]">
                                                {relativeTime(row.lastReceivedAt)}
                                            </span>
                                            {row.messageCount > 0 && (
                                                <span className="rounded-full bg-[rgba(236,185,20,0.2)] px-1.5 text-[10px] font-bold text-[var(--lagoon-deep)] dark:text-[var(--lagoon)]">
                                                    {row.messageCount.toLocaleString()}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                            <div>
                                <h3 className="m-0 text-sm font-semibold text-[var(--sea-ink)] dark:text-zinc-100">
                                    {selectedChat ? selectedChat.title : 'All chats'}
                                </h3>
                                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                                    {selectedChat
                                        ? `${selectedChat.messageCount.toLocaleString()} messages`
                                        : `Newest first · ${totalMessages.toLocaleString()} total`}
                                </p>
                            </div>
                            <select
                                aria-label="Choose chat"
                                value={chatId ?? ''}
                                onChange={(event) => setChatId(event.target.value || undefined)}
                                className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)] dark:text-zinc-200 lg:hidden"
                            >
                                <option value="">All chats</option>
                                {summaries.map((row) => (
                                    <option key={row.chatId} value={row.chatId}>
                                        {row.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)]">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <h4 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                                        {selectedChat ? 'No messages in this chat yet' : 'No Ingested Messages'}
                                    </h4>
                                    <p className="mt-1 max-w-sm text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400">
                                        {selectedChat
                                            ? 'Messages from this monitored chat will appear here the moment they are received.'
                                            : 'No messages received from monitored chats yet. They will appear here in real time.'}
                                    </p>
                                </div>
                            ) : (
                                <ul className="m-0 flex flex-col gap-2">
                                    {(() => {
                                        const rows: JSX.Element[] = []
                                        let lastDayKey: string | null = null
                                        for (const message of items) {
                                            const dayKey = dayKeyOf(message.receivedAt)
                                            if (dayKey !== lastDayKey) {
                                                lastDayKey = dayKey
                                                rows.push(
                                                    <li
                                                        key={`day-${dayKey}`}
                                                        className="sticky top-0 z-10 my-1 self-center rounded-full border border-[var(--line)] bg-[var(--header-bg)] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
                                                    >
                                                        {dayLabel(message.receivedAt)}
                                                    </li>,
                                                )
                                            }
                                            rows.push(
                                                <li key={message.id} className="flex">
                                                    <div
                                                        className={`max-w-[85%] min-w-0 rounded-2xl rounded-tl-sm px-3.5 py-2.5 transition ${
                                                            newHeads.includes(message.id)
                                                                ? 'ring-2 ring-[var(--lagoon)]'
                                                                : 'border border-[var(--line)]'
                                                        } bg-[var(--header-bg)]`}
                                                    >
                                                        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-xs">
                                                            <span className="font-semibold text-[var(--lagoon-deep)] dark:text-[var(--lagoon)]">
                                                                {message.senderName ?? 'Unknown'}
                                                            </span>
                                                            {chatId === undefined && (
                                                                <span className="font-medium text-[var(--sea-ink-soft)]">
                                                                    {message.chat.title}
                                                                </span>
                                                            )}
                                                            <span className="ml-auto text-[10px] text-[var(--sea-ink-soft)]">
                                                                {formatTime(message.receivedAt)}
                                                            </span>
                                                        </p>
                                                        <p className="m-0 mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--sea-ink)] dark:text-zinc-200">
                                                            {message.text}
                                                        </p>
                                                    </div>
                                                </li>,
                                            )
                                        }
                                        return rows
                                    })()}
                                </ul>
                            )}

                            {hasMore && (
                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => void load(false)}
                                        className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-2 text-xs font-semibold text-[var(--sea-ink)] transition hover:border-[var(--lagoon)] dark:text-zinc-200"
                                    >
                                        Load older
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </section>
    )
}

function initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TG'
}

function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function dayKeyOf(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'unknown'
    return date.toDateString()
}

function dayLabel(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'Unknown date'
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((startOfDay.getTime() - startOfTarget.getTime()) / 86_400_000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
    })
}

function relativeTime(iso: string | null): string {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const diffMs = Date.now() - date.getTime()
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return date.toLocaleDateString()
}