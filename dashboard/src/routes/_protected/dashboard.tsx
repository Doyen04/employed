import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, MessageSquareMore, Radar, Radio } from 'lucide-react'

import { getTelegramStatus } from '../../server/telegram'
import { listChats } from '../../server/chats'
import { LiveFeed } from '../../components/dashboard/LiveFeed'
import { Panel } from '../../components/dashboard/Panel'
import { WorkerStatusPill } from '../../components/dashboard/WorkerStatusPill'
import type { WorkerChat, WorkerTelegramStatus } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/dashboard')({ component: OverviewPage })

function OverviewPage() {
  const [status, setStatus] = useState<WorkerTelegramStatus | null>(null)
  const [chats, setChats] = useState<WorkerChat[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const [nextStatus, chatsResult] = await Promise.all([getTelegramStatus(), listChats()])
        if (!alive) return
        setStatus(nextStatus)
        setChats(chatsResult.items)
        setError(null)
      } catch (err) {
        if (alive) setError(errorText(err))
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <Panel title="Worker unreachable" description="The dashboard talks to the worker over its HTTP API.">
        <p role="alert" className="m-0 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      </Panel>
    )
  }

  const monitored = chats.filter((chat) => chat.isMonitored).length
  const telegramLabel = status === null ? '…' : status.loggedIn ? 'Telegram online' : 'Needs login'

  return (
    <div className="flex flex-col gap-4">
      <section className="island-shell relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.24),transparent_66%)]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Overview</p>
            <h1 className="display-title m-0 text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
              {chats.length > 0
                ? `${monitored} of ${chats.length} chats monitored`
                : 'Telegram not connected'}
            </h1>
            <p className="mb-0 mt-2 max-w-xl text-sm text-[var(--sea-ink-soft)]">
              New messages are analyzed in real time; matches flow into the live feed below.
            </p>
          </div>
          <WorkerStatusPill />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Radar} label="Chats" value={String(chats.length)} />
          <StatCard icon={Radio} label="Monitored" value={String(monitored)} />
          <StatCard icon={MessageSquareMore} label="Telegram session" value={telegramLabel} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Live analysis" description="Via the browser → worker socket.">
          <LiveFeed />
        </Panel>

        <Panel title="Quick actions">
          <ul className="m-0 flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="group flex items-center justify-between rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline hover:border-[rgba(50,143,151,0.4)]"
                >
                  {link.label}
                  <ArrowUpRight className="h-4 w-4 text-[var(--sea-ink-soft)] transition group-hover:text-[var(--lagoon-deep)]" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radar
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-[var(--header-bg)] px-5 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
        <Icon className="h-3.5 w-3.5 text-[var(--lagoon-deep)]" aria-hidden="true" />
        {label}
      </div>
      <p className="m-0 mt-1.5 truncate text-lg font-bold text-[var(--sea-ink)]">{value}</p>
    </div>
  )
}

const QUICK_LINKS = [
  { to: '/chats' as const, label: 'Choose monitored chats' },
  { to: '/telegram' as const, label: 'Manage the Telegram session' },
  { to: '/settings' as const, label: 'Tune analysis prompts & rules' },
  { to: '/action-logs' as const, label: 'Review dispatched actions' },
]