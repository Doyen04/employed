import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Radio, RefreshCw, Search, Zap } from 'lucide-react'

import { listChats, refreshChats, updateChat } from '../../server/chats'
import { getTelegramStatus } from '../../server/telegram'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { WorkerChat } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/chats')({ component: ChatsPage })

type ChatFilter = 'all' | 'monitored' | 'paused'

const FILTERS: { key: ChatFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'monitored', label: 'Monitored' },
    { key: 'paused', label: 'Paused' },
]

function ChatsPage() {
    const [chats, setChats] = useState<WorkerChat[]>([])
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
    const [filter, setFilter] = useState<ChatFilter>('all')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function load() {
        setLoading(true)
        setError(null)
        try {
            const [chatsRes, statusRes] = await Promise.allSettled([
                listChats(),
                getTelegramStatus(),
            ])
            if (chatsRes.status === 'fulfilled') {
                setChats(chatsRes.value.items)
            } else {
                setError(errorText(chatsRes.reason))
            }
            if (statusRes.status === 'fulfilled') {
                setTelegramLoggedIn(statusRes.value.loggedIn)
            }
        } catch (err) {
            setError(errorText(err))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [])

    async function handleRefresh() {
        setLoading(true)
        setRefreshing(true)
        setError(null)
        try {
            await refreshChats()
            await load()
        } catch (err) {
            setError(errorText(err))
        } finally {
            setRefreshing(false)
        }
    }

    async function handleToggleMonitor(chat: WorkerChat) {
        const previous = chats
        setChats((current) =>
            current.map((item) =>
                item.id === chat.id ? { ...item, isMonitored: !item.isMonitored } : item,
            ),
        )
        try {
            await updateChat({ data: { id: chat.id, isMonitored: !chat.isMonitored } })
        } catch (err) {
            setChats(previous)
            setError(errorText(err))
        }
    }

    const monitoredCount = chats.filter((chat) => chat.isMonitored).length
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return chats.filter((chat) => {
            const matchesFilter =
                filter === 'all' ? true : filter === 'monitored' ? chat.isMonitored : !chat.isMonitored
            if (!q) return matchesFilter
            return (
                matchesFilter &&
                (chat.title.toLowerCase().includes(q) || chat.telegramChatId.includes(q))
            )
        })
    }, [chats, filter, query])

    if (loading) return <PageSkeleton label="Loading chats" />

    return (
        <Panel
            title="Chats"
            description="Pull the account’s dialogs from Telegram and choose which ones are monitored."
            action={
                telegramLoggedIn ? (
                    <button onClick={handleRefresh} disabled={refreshing} className="app-primary-button disabled:cursor-wait disabled:opacity-50">
                        <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                        {refreshing ? 'Refreshing…' : 'Refresh from Telegram'}
                    </button>
                ) : undefined
            }
        >
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            {!telegramLoggedIn ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-(--line) bg-(--surface) my-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon) mb-3">
                        <Radio className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                        Telegram Disconnected
                    </h3>
                    <p className="mt-1 text-xs text-(--sea-ink-soft) dark:text-zinc-400 max-w-sm">
                        Your Telegram session is not connected. Connect your account to automatically import and monitor your groups, channels, and chats.
                    </p>
                    <Link
                        to="/telegram"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-(--lagoon-deep) dark:bg-(--lagoon) dark:text-[#4F3D35] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Connect Telegram Account
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-(--line) bg-(--surface) my-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon) mb-3">
                        <Radio className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                        No Monitored Chats
                    </h3>
                    <p className="mt-1 text-xs text-(--sea-ink-soft) dark:text-zinc-400 max-w-sm">
                        No chats imported yet. Click "Refresh from Telegram" above to discover your Telegram account's dialogs.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-(--line)">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) bg-(--surface-strong) px-4 py-3">
                        <p className="m-0 text-xs text-(--sea-ink-soft)">
                            {chats.length} dialogs · <b className="text-(--sea-ink) dark:text-zinc-200">{monitoredCount} monitored</b>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--sea-ink-soft)" aria-hidden="true" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search chats…"
                                    aria-label="Search chats"
                                    className="w-44 rounded-full border border-(--line) bg-(--surface) py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                                />
                            </div>
                            <div className="flex items-center gap-1 rounded-full border border-(--line) bg-(--surface) p-1">
                            {FILTERS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFilter(key)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === key
                                        ? 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep) dark:text-(--lagoon)'
                                        : 'text-(--sea-ink-soft) hover:text-(--sea-ink) dark:hover:text-zinc-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-left text-sm">
                            <thead>
                                <tr className="border-b border-(--line) text-xs uppercase tracking-wider text-(--sea-ink-soft)">
                                    <th className="px-4 py-2.5 font-semibold">Chat</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Telegram ID</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-(--sea-ink-soft)">
                                            No chats match {query ? `"${query}"` : 'the filter'}.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((chat) => (
                                        <tr
                                            key={chat.id}
                                            className="border-b border-(--line) transition last:border-0 hover:bg-(--surface-strong)"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(236,185,20,0.18)] text-xs font-bold text-(--lagoon-deep) dark:text-(--lagoon)">
                                                        {initials(chat.title)}
                                                    </span>
                                                    <span className="truncate font-medium text-(--sea-ink) dark:text-zinc-100">
                                                        {chat.title}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-(--sea-ink-soft)">
                                                {chat.telegramChatId}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chat.isMonitored
                                                        ? 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep) dark:text-(--lagoon)'
                                                        : 'bg-[rgba(79,61,53,0.08)] text-(--sea-ink-soft) dark:bg-zinc-800 dark:text-zinc-400'
                                                    }`}
                                                >
                                                    {chat.isMonitored && <Radio className="h-3 w-3" aria-hidden="true" />}
                                                    {chat.isMonitored ? 'Monitoring' : 'Paused'}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                <button
                                                    onClick={() => void handleToggleMonitor(chat)}
                                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                                                        chat.isMonitored
                                                            ? 'bg-zinc-200/60 text-(--sea-ink-soft) hover:bg-zinc-300/60 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                                                            : 'bg-[rgba(236,185,20,0.2)] text-(--lagoon-deep) dark:text-(--lagoon) border border-[rgba(236,185,20,0.35)] hover:opacity-90'
                                                    }`}
                                                >
                                                    {chat.isMonitored ? 'Pause' : 'Monitor'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Panel>
    )
}

function initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TG'
}