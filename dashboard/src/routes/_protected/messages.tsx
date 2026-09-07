import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, MessageSquare, Zap } from 'lucide-react'

import { listChats } from '../../server/chats'
import { listMessages } from '../../server/messages'
import { getTelegramStatus } from '../../server/telegram'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerChat, WorkerMessage } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/messages')({ component: MessagesPage })

const PAGE_SIZE = 50

function MessagesPage() {
    const [chats, setChats] = useState<WorkerChat[]>([])
    const [chatId, setChatId] = useState<string | undefined>(undefined)
    const [items, setItems] = useState<WorkerMessage[]>([])
    const [telegramLoggedIn, setTelegramLoggedIn] = useState<boolean>(true)
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
            setItems((previous) => (reset ? result.items : [...previous, ...result.items]))
            setCursor(result.nextCursor)
            setHasMore(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset) setLoading(false)
        }
    }

    useEffect(() => {
        let alive = true
        async function init() {
            try {
                const [chatsResult, statusRes] = await Promise.allSettled([
                    listChats(),
                    getTelegramStatus(),
                ])
                if (alive) {
                    if (chatsResult.status === 'fulfilled') setChats(chatsResult.value.items)
                    if (statusRes.status === 'fulfilled') setTelegramLoggedIn(statusRes.value.loggedIn)
                }
            } catch {
                // chat filter is optional
            }
        }
        void init()
        void load(true)
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        void load(true)
    }, [chatId])

    return (
        <Panel
            title="Messages"
            description="Every message persisted from the monitored chats, newest first."
            action={
                chats.length > 0 ? (
                    <select
                        value={chatId ?? ''}
                        onChange={(event) => setChatId(event.target.value || undefined)}
                        className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 outline-none transition focus:border-[var(--lagoon)]"
                    >
                        <option value="">All monitored chats</option>
                        {chats.map((chat) => (
                            <option key={chat.id} value={chat.id}>
                                {chat.title}
                            </option>
                        ))}
                    </select>
                ) : undefined
            }
        >
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            {loading ? (
                <p className="inline-flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading messages…
                </p>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] my-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--lagoon)]/15 text-[var(--sea-ink)] dark:text-[var(--lagoon)] mb-3">
                        <MessageSquare className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                        {!telegramLoggedIn ? 'Telegram Disconnected' : 'No Ingested Messages'}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-400 max-w-sm leading-relaxed">
                        {!telegramLoggedIn
                            ? 'Telegram is currently disconnected. Re-connect your account to start receiving and analyzing messages.'
                            : 'No messages have been received from monitored chats yet. Mark chats as "Monitored" on the Chats page to start ingesting messages.'}
                    </p>
                    {!telegramLoggedIn && (
                        <Link
                            to="/telegram"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--lagoon-deep)] dark:bg-[var(--lagoon)] dark:text-[#4F3D35] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Connect Telegram Account
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <ul className="m-0 flex flex-col gap-2">
                        {items.map((message) => (
                            <li
                                key={message.id}
                                className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)] px-4 py-2.5"
                            >
                                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--sea-ink)] dark:text-zinc-100">
                                    <span className="font-semibold">{message.chat?.title ?? 'Unknown Chat'}</span>
                                    <span className="text-[var(--sea-ink-soft)] dark:text-zinc-400 text-xs">
                                        {message.senderName ?? 'Unknown'} · {formatTime(message.receivedAt)}
                                    </span>
                                </p>
                                <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)] dark:text-zinc-300 leading-relaxed">{message.text}</p>
                            </li>
                        ))}
                    </ul>
                    {hasMore && (
                        <button
                            onClick={() => void load(false)}
                            className="mt-4 rounded-full border border-[var(--line)] bg-[var(--header-bg)] px-5 py-2 text-xs font-semibold text-[var(--sea-ink)] dark:text-zinc-200 transition hover:border-[var(--lagoon)]"
                        >
                            Load more
                        </button>
                    )}
                </>
            )}
        </Panel>
    )
}

function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}