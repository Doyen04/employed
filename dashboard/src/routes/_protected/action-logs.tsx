import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { listActionLogs } from '../../server/actionLogs'
import { Panel } from '../../components/dashboard/Panel'
import type { WorkerActionLog } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/action-logs')({ component: ActionLogsPage })

const PAGE_SIZE = 50

function ActionLogsPage() {
  const [items, setItems] = useState<WorkerActionLog[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(reset: boolean) {
    if (reset) setLoading(true)
    setError(null)
    try {
      const result = await listActionLogs({
        data: { limit: PAGE_SIZE, cursor: reset ? undefined : (cursor ?? undefined) },
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
    void load(true)
  }, [])

  return (
    <Panel
      title="Action logs"
      description="Every dispatch attempt the worker has made, with its outcome."
    >
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading action logs…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">No actions dispatched yet.</p>
      ) : (
        <>
          <ul className="m-0 flex flex-col gap-2">
            {items.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
              >
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[var(--sea-ink)]">
                  <StatusBadge status={log.status} />
                  <span className="font-semibold">{log.notifier.name}</span>
                  <span className="text-[var(--sea-ink-soft)]">
                    {log.analysis.analysisConfigName} · {formatTime(log.analysis.analyzedAt)}
                  </span>
                </p>
                <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                  {log.analysis.message.chat.title}: “{truncate(log.analysis.message.text, 160)}”
                </p>
                {log.status === 'failed' && log.errorDetail && (
                  <p className="m-0 mt-1 text-xs text-red-500">{log.errorDetail}</p>
                )}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => void load(false)}
              className="mt-4 rounded-full border border-[var(--line)] bg-[var(--header-bg)] px-5 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:border-[var(--lagoon)]"
            >
              Load more
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

function StatusBadge({ status }: { status: WorkerActionLog['status'] }) {
  const styles: Record<WorkerActionLog['status'], string> = {
    sent: 'bg-[rgba(236,185,20,0.18)] text-[var(--lagoon-deep)]',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}