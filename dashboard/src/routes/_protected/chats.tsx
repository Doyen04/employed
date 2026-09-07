import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Radio, RefreshCw, Zap } from 'lucide-react'

import { listChats, refreshChats, updateChat } from '../../server/chats'
import { getTelegramStatus } from '../../server/telegram'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerChat } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/chats')({ component: ChatsPage })

function ChatsPage() {
    const [chats, setChats] = useState<WorkerChat[]>([])
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
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

    return (
        <Panel
            title="Chats"
            description="Pull the account’s dialogs from Telegram and choose which ones are monitored."
            action={
                telegramLoggedIn ? (
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--header-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 transition hover:border-[var(--lagoon)] disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {refreshing ? 'Refreshing…' : 'Refresh from Telegram'}
                    </button>
                ) : undefined
            }
        >
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            {loading ? (
                <p className="text-sm text-[var(--sea-ink-soft)]">Loading chats…</p>
            ) : !telegramLoggedIn ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] my-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)] mb-3">
                        <Radio className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                        Telegram Disconnected
                    </h3>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 max-w-sm">
                        Your Telegram session is not connected. Connect your account to automatically import and monitor your groups, channels, and chats.
                    </p>
                    <Link
                        to="/telegram"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--lagoon-deep)] dark:bg-[var(--lagoon)] dark:text-[#4F3D35] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        Connect Telegram Account
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] my-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)] mb-3">
                        <Radio className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                        No Monitored Chats
                    </h3>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 max-w-sm">
                        No chats imported yet. Click "Refresh from Telegram" above to discover your Telegram account's dialogs.
                    </p>
                </div>
            ) : (
                <ul className="m-0 flex flex-col gap-2">
                    {chats.map((chat) => (
                        <li
                            key={chat.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--header-bg)] px-4 py-2.5"
                        >
                            <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)] dark:text-zinc-100">
                                    {chat.title}
                                </p>
                                <p className="m-0 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 font-mono">
                                    ID: {chat.telegramChatId}
                                </p>
                            </div>
                            <button
                                onClick={() => void handleToggleMonitor(chat)}
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${chat.isMonitored
                                        ? 'bg-[rgba(236,185,20,0.2)] text-[var(--lagoon-deep)] dark:text-[var(--lagoon)] border border-[rgba(236,185,20,0.35)]'
                                        : 'bg-zinc-200/60 dark:bg-zinc-800 text-[var(--sea-ink-soft)] dark:text-zinc-400'
                                    }`}
                            >
                                {chat.isMonitored ? 'Monitoring' : 'Paused'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    )
}