import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Inbox, MessageSquare, Radio, RefreshCw, Search, Zap } from 'lucide-react'

import { listMessages, messageSummary } from '../../server/messages'
import { getTelegramStatus } from '../../server/telegram'
import { connectRealtime } from '../../client/socket'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import type { LogTableColumn } from '../../components/dashboard/LogTable'
import { DetailsDrawer } from '../../components/dashboard/DetailsDrawer'
import type { RealtimeMessageStored, WorkerMessage, WorkerMessageSummary } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/messages')({ component: MessagesPage })

const PAGE_SIZE = 50
const MAX_ITEMS = 200

function MessagesPage() {
    const [summaries, setSummaries] = useState<WorkerMessageSummary[]>([])
    const [selected, setSelected] = useState<WorkerMessageSummary | null>(null)
    const [items, setItems] = useState<WorkerMessage[]>([])
    const [newHeads, setNewHeads] = useState<string[]>([])
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
    const [booting, setBooting] = useState(true)
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')

    const chatId = selected?.chatId

    async function loadThread(reset: boolean) {
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

    async function refresh() {
        setError(null)
        try {
            const [sumRes, statusRes] = await Promise.allSettled([
                messageSummary(),
                getTelegramStatus(),
            ])
            if (sumRes.status === 'fulfilled') setSummaries(sumRes.value)
            if (statusRes.status === 'fulfilled') setTelegramLoggedIn(statusRes.value.loggedIn)
        } catch (err) {
            setError(errorText(err))
        }
    }

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
            setBooting(false)
        }
        void init()
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        if (selected) void loadThread(true)
    }, [selected])

    useEffect(() => {
        const unsubscribe = connectRealtime({
            onMessageStored: (payload) => {
                const event = payload as RealtimeMessageStored
                if (selected && event.message.chatId === selected.chatId) {
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
    }, [selected, flashNew])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return summaries
        return summaries.filter(
            (row) =>
                row.title.toLowerCase().includes(q) || row.telegramChatId.includes(q),
        )
    }, [summaries, query])

    const totalMessages = summaries.reduce((sum, row) => sum + row.messageCount, 0)

    if (booting) return <PageSkeleton label="Loading messages" />

    const columns: LogTableColumn<WorkerMessageSummary>[] = [
        {
            header: 'Chat',
            cell: (row) => (
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(236,185,20,0.18)] text-xs font-bold text-(--lagoon-deep) dark:text-(--lagoon)">
                        {initials(row.title)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-(--sea-ink) dark:text-zinc-100">
                        {row.title}
                    </span>
                </div>
            ),
        },
        {
            header: 'Telegram ID',
            hiddenOnMobile: true,
            cell: (row) => (
                <span className="whitespace-nowrap font-mono text-xs text-(--sea-ink-soft)">
                    {row.telegramChatId}
                </span>
            ),
        },
        {
            header: 'Messages',
            cell: (row) => (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgba(236,185,20,0.18)] px-2.5 py-0.5 text-xs font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                    {row.messageCount.toLocaleString()}
                </span>
            ),
        },
        {
            header: 'Last message',
            cell: (row) => (
                <span className="block max-w-72 truncate text-xs text-(--sea-ink-soft)">
                    {row.lastText ?? 'No messages yet'}
                </span>
            ),
        },
        {
            header: 'Last activity',
            align: 'right',
            cell: (row) => (
                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)" title={row.lastReceivedAt ?? ''}>
                    {relativeTime(row.lastReceivedAt)}
                </span>
            ),
        },
    ]

    return (
        <>
            <section className="island-shell overflow-hidden rounded-2xl p-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--line) px-4 py-3.5 sm:px-5 sm:py-4">
                    <div>
                        <h2 className="m-0 text-base font-semibold text-(--sea-ink)">Messages</h2>
                        <p className="m-0 mt-0.5 text-sm text-(--sea-ink-soft)">
                            Every message from your monitored chats — open a conversation to read its thread.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--sea-ink-soft)">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            Live
                        </span>
                        <button
                            onClick={() => void refresh()}
                            className="app-primary-button"
                        >
                            <RefreshCw aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                </div>

                {error && <p className="border-b border-(--line) px-5 py-2 text-sm text-red-500">{error}</p>}

                {!telegramLoggedIn ? (
                    <div className="flex flex-col items-center justify-center p-10 text-center">
                        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                            <Radio className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                            Telegram Disconnected
                        </h3>
                        <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                            Your Telegram session is not connected. Connect your account to import and monitor your groups, channels, and chats.
                        </p>
                        <Link
                            to="/telegram"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-(--lagoon-deep) px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 dark:bg-(--lagoon) dark:text-[#4F3D35]"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Connect Telegram Account
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                ) : summaries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10 text-center">
                        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                            <Inbox className="h-6 w-6" />
                        </div>
                        <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                            No Monitored Chats
                        </h3>
                        <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                            Mark chats as "Monitored" on the Chats page to start persisting their messages here.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) bg-(--surface) px-3 py-2 mx-4 sm:mx-5">
                            <p className="m-0 text-xs text-(--sea-ink-soft)">
                                {summaries.length} monitored chats ·{' '}
                                <b className="text-(--sea-ink) dark:text-zinc-200">{totalMessages.toLocaleString()} messages</b>
                            </p>
                            <div className="relative min-w-40 flex-1 sm:max-w-64">
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--sea-ink-soft)"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search chats…"
                                    aria-label="Search chats"
                                    className="w-full rounded-full border border-(--line) bg-(--surface-strong) py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <p className="px-8 pb-8 text-center text-sm text-(--sea-ink-soft)">
                                No chats match {query ? `"${query}"` : ''}.
                            </p>
                        ) : (
                            <div className="px-4 sm:px-5 pb-5">
                                <LogTable<WorkerMessageSummary>
                                    rows={filtered}
                                    rowKey={(row) => row.chatId}
                                    onRowClick={setSelected}
                                    rowAriaLabel={() => 'Open conversation'}
                                    columns={columns}
                                />
                            </div>
                        )}
                    </>
                )}
            </section>

            {selected ? (
                <DetailsDrawer
                    ariaLabel={`Messages from ${selected.title}`}
                    icon={<MessageSquare className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />}
                    title={selected.title}
                    subtitle={
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                            {selected.messageCount.toLocaleString()} messages
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
                    {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-xs text-(--sea-ink-soft)">
                            Loading messages…
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                                <MessageSquare className="h-6 w-6" />
                            </div>
                            <h4 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                                No messages in this chat yet
                            </h4>
                            <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                                Messages from this monitored chat will appear here the moment they are received.
                            </p>
                        </div>
                    ) : (
                        <ul className="m-0 flex flex-col gap-2">
                            {(() => {
                                const rows: ReactElement[] = []
                                let lastDayKey: string | null = null
                                for (const message of items) {
                                    const dayKey = dayKeyOf(message.receivedAt)
                                    if (dayKey !== lastDayKey) {
                                        lastDayKey = dayKey
                                        rows.push(
                                            <li
                                                key={`day-${dayKey}`}
                                                className="my-1 self-center rounded-full border border-(--line) bg-(--header-bg) px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)"
                                            >
                                                {dayLabel(message.receivedAt)}
                                            </li>,
                                        )
                                    }
                                    rows.push(
                                        <li key={message.id} className="flex">
                                            <div
                                                className={`max-w-[85%] min-w-0 rounded-2xl rounded-tl-sm px-3.5 py-2.5 transition ${newHeads.includes(message.id)
                                                        ? 'ring-2 ring-(--lagoon)'
                                                        : 'border border-(--line)'
                                                    } bg-(--header-bg)`}
                                            >
                                                <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-xs">
                                                    <span className="font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                                                        {message.senderName ?? 'Unknown'}
                                                    </span>
                                                    <span className="ml-auto text-[10px] text-(--sea-ink-soft)">
                                                        {formatTime(message.receivedAt)}
                                                    </span>
                                                </p>
                                                <p className="m-0 mt-0.5 break-words whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink) dark:text-zinc-200">
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
                                onClick={() => void loadThread(false)}
                                className="rounded-full border border-(--line) bg-(--surface-strong) px-5 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200"
                            >
                                Load older
                            </button>
                        </div>
                    )}
                </DetailsDrawer>
            ) : null}
        </>
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
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
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