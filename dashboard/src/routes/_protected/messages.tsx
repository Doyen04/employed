import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, Inbox, MessageSquare, Radio, RefreshCw, Search, Zap } from 'lucide-react'

import { listMessages, messageSummary, deleteMessage } from '../../server/messages'
import { getTelegramStatus } from '../../server/telegram'
import { connectRealtime } from '../../client/socket'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { DetailsDrawer } from '../../components/dashboard/DetailsDrawer'
import { LogTable } from '../../components/dashboard/LogTable'
import type { RealtimeMessageStored, WorkerMessage, WorkerMessageSummary } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { initials, formatTime } from '../../lib/helpers'

export const Route = createFileRoute('/_protected/messages')({ component: MessagesPage })

const PAGE_SIZE = 50
const MAX_ITEMS = 200

function MessagesPage() {
    const [summaries, setSummaries] = useState<WorkerMessageSummary[]>([])
    const [selected, setSelected] = useState<WorkerMessage | null>(null)
    const [items, setItems] = useState<WorkerMessage[]>([])
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
    const [booting, setBooting] = useState(true)
    const [listCursor, setListCursor] = useState<string | null>(null)
    const [hasMoreList, setHasMoreList] = useState(false)
    const [loadingList, setLoadingList] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')

    async function loadMessages(reset: boolean) {
        if (reset) setLoadingList(true)
        setError(null)
        try {
            const result = await listMessages({
                data: {
                    limit: PAGE_SIZE,
                    cursor: reset ? undefined : (listCursor ?? undefined),
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
            setListCursor(result.nextCursor)
            setHasMoreList(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset) setLoadingList(false)
        }
    }

    async function refresh() {
        setError(null)
        const [sumRes, statusRes, msgRes] = await Promise.allSettled([
            messageSummary(),
            getTelegramStatus(),
            loadMessages(true),
        ])
        if (sumRes.status === 'fulfilled') setSummaries(sumRes.value)
        if (statusRes.status === 'fulfilled') setTelegramLoggedIn(statusRes.value.loggedIn)
        if (msgRes.status === 'rejected') setError(errorText(msgRes.reason))
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
        void loadMessages(true)
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        const unsubscribe = connectRealtime({
            onMessageStored: (payload) => {
                const event = payload as RealtimeMessageStored
                setItems((previous) => {
                    if (previous.some((message) => message.id === event.message.id)) return previous
                    return [event.message, ...previous].slice(0, MAX_ITEMS)
                })
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
    }, [])

    const summaryById = useMemo(
        () => new Map(summaries.map((row) => [row.chatId, row])),
        [summaries],
    )

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return items
        return items.filter(
            (message) =>
                message.text.toLowerCase().includes(q) ||
                (message.senderName ?? '').toLowerCase().includes(q) ||
                message.chat.title.toLowerCase().includes(q),
        )
    }, [items, query])

    function toggleGroup(targetChatId: string) {
        setCollapsed((previous) => {
            const next = new Set(previous)
            if (next.has(targetChatId)) next.delete(targetChatId)
            else next.add(targetChatId)
            return next
        })
    }

    function selectChat(message: WorkerMessage) {
        setSelected(message)
    }

    async function confirmDelete(message: WorkerMessage) {
        if (!window.confirm('Delete this message permanently? Its analyses and actions are also removed.')) return
        setError(null)
        try {
            await deleteMessage({ data: { id: message.id } })
            setItems((previous) => previous.filter((row) => row.id !== message.id))
            setSelected((current) => (current?.id === message.id ? null : current))
        } catch (err) {
            setError(errorText(err))
        }
    }

    const groupHeader = (targetChatId: string) => {
        const summary = summaryById.get(targetChatId)
        const first = items.find((message) => message.chatId === targetChatId)
        const title = summary?.title ?? first?.chat.title ?? targetChatId
        const telegramChatId = summary?.telegramChatId ?? first?.chat.telegramChatId ?? ''
        const count = summary?.messageCount ?? 0
        const lastAt = summary?.lastReceivedAt ?? first?.receivedAt ?? null
        return (
            <div className="flex min-w-0 items-center gap-2.5">
                <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-(--sea-ink-soft) transition-transform ${collapsed.has(targetChatId) ? '-rotate-90' : ''}`}
                    aria-hidden="true"
                />
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(236,185,20,0.18)] text-xs font-bold text-(--lagoon-deep) dark:text-(--lagoon)">
                    {initials(title)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-(--sea-ink) dark:text-zinc-100">
                        {title}
                    </span>
                    <span className="hidden truncate font-mono text-[11px] text-(--sea-ink-soft) sm:block">
                        {telegramChatId}
                    </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgba(236,185,20,0.18)] px-2.5 py-0.5 text-xs font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                    {count.toLocaleString()}
                </span>
                <span
                    className="shrink-0 whitespace-nowrap text-xs text-(--sea-ink-soft)"
                    title={lastAt ?? ''}
                >
                    {relativeTime(lastAt)}
                </span>
            </div>
        )
    }

    const totalMessages = summaries.reduce((sum, row) => sum + row.messageCount, 0)

    if (booting) return <PageSkeleton label="Loading messages" />

    return (
        <>
            <section className="island-shell overflow-hidden rounded-2xl p-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--line) px-4 py-3.5 sm:px-5 sm:py-4">
                    <div>
                        <h2 className="m-0 text-base font-semibold text-(--sea-ink)">Messages</h2>
                        <p className="m-0 mt-0.5 text-sm text-(--sea-ink-soft)">
                            Every message from your monitored chats, grouped by chat — click a group to collapse it, or open a chat to read its thread.
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
                                    placeholder="Search messages…"
                                    aria-label="Search messages"
                                    className="w-full rounded-full border border-(--line) bg-(--surface-strong) py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        {loadingList ? (
                            <p className="px-8 pb-8 text-center text-sm text-(--sea-ink-soft)">
                                Loading messages…
                            </p>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center">
                                <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                                    {query ? 'No matches' : 'No messages yet'}
                                </h3>
                                <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                                    {query
                                        ? `Nothing matches "${query}" in the messages loaded so far.`
                                        : 'Messages from your monitored chats will appear here the moment they are received.'}
                                </p>
                            </div>
                        ) : (
                            <div className="px-4 sm:px-5 pb-5">
                                <LogTable<WorkerMessage>
                                    rows={filteredItems}
                                    rowKey={(message) => message.id}
                                    onRowClick={selectChat}
                                    onDelete={(message) => void confirmDelete(message)}
                                    rowAriaLabel={() => 'Open conversation'}
                                    grouping={{
                                        groupBy: (message) => message.chatId,
                                        groupHeader,
                                        collapsedGroups: collapsed,
                                        onToggleGroup: toggleGroup,
                                    }}
                                    columns={[
                                        {
                                            header: 'Sender',
                                            cell: (message) => (
                                                <span className="whitespace-nowrap font-medium text-(--sea-ink-soft)">
                                                    {message.senderName ?? 'Unknown'}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Message',
                                            cell: (message) => (
                                                <span className="block max-w-80 truncate text-(--sea-ink)">
                                                    {message.text}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Time',
                                            align: 'right',
                                            cell: (message) => (
                                                <span
                                                    className="whitespace-nowrap text-xs text-(--sea-ink-soft)"
                                                    title={message.receivedAt}
                                                >
                                                    {formatTime(message.receivedAt)}
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
                                {hasMoreList && (
                                    <div className="mt-4 flex justify-center">
                                        <button
                                            onClick={() => void loadMessages(false)}
                                            className="rounded-full border border-(--line) bg-(--surface-strong) px-5 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200"
                                        >
                                            Load older
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>

            {selected ? (
                <DetailsDrawer
                    ariaLabel={`Message from ${selected.senderName ?? 'Unknown'}`}
                    icon={<MessageSquare className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />}
                    title={selected.chat.title}
                    subtitle={
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                            From {selected.senderName ?? 'Unknown'} · {formatTime(selected.receivedAt)}
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
                    <div className="flex flex-col gap-2">
                        <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-sm bg-(--header-bg) px-3.5 py-2.5">
                            <p className="m-0 mt-0.5 wrap-break-word whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink) dark:text-zinc-200">
                                {selected.text}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelected(null)}
                            className="mt-2 self-start rounded-full border border-(--line) bg-(--surface-strong) px-4 py-1.5 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200"
                        >
                            Close
                        </button>
                    </div>
                </DetailsDrawer>
            ) : null}
        </>
    )
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