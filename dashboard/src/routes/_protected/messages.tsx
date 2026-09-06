import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { listChats } from '../../server/chats'
import { listMessages } from '../../server/messages'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerChat, WorkerMessage } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/messages')({ component: MessagesPage })

const PAGE_SIZE = 50

function MessagesPage() {
  const [chats, setChats] = useState<WorkerChat[]>([])
  const [chatId, setChatId] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<WorkerMessage[]>([])
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
        const chatsResult = await listChats()
        if (alive) setChats(chatsResult.items)
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
        <select
          value={chatId ?? ''}
          onChange={(event) => setChatId(event.target.value || undefined)}
          className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] outline-none transition focus:border-[rgba(50,143,151,0.6)]"
        >
          <option value="">All chats</option>
          {chats.map((chat) => (
            <option key={chat.id} value={chat.id}>
              {chat.title}
            </option>
          ))}
        </select>
      }
    >
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading messages…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">No messages stored yet.</p>
      ) : (
        <>
          <ul className="m-0 flex flex-col gap-2">
            {items.map((message) => (
              <li
                key={message.id}
                className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
              >
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--sea-ink)]">
                  <span className="font-semibold">{message.chat.title}</span>
                  <span className="text-[var(--sea-ink-soft)]">
                    {message.senderName ?? 'Unknown'} · {formatTime(message.receivedAt)}
                  </span>
                </p>
                <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">{message.text}</p>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => void load(false)}
              className="mt-4 rounded-full border border-(--line) bg-[var(--header-bg)] px-5 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(50,143,151,0.4)]"
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