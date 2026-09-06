import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'

import { listChats, refreshChats, updateChat } from '../../server/chats'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerChat } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/chats')({ component: ChatsPage })

function ChatsPage() {
  const [chats, setChats] = useState<WorkerChat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { items } = await listChats()
      setChats(items)
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
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-[var(--header-bg)] px-4 py-1.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(50,143,151,0.4)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Refreshing…' : 'Refresh from Telegram'}
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading chats…</p>
      ) : chats.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          No chats yet — press “Refresh from Telegram” to pull the account’s dialogs.
        </p>
      ) : (
        <ul className="m-0 flex flex-col gap-2">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                  {chat.title}
                </p>
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{chat.telegramChatId}</p>
              </div>
              <button
                onClick={() => void handleToggleMonitor(chat)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  chat.isMonitored
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
    </Panel>
  )
}