import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { listAnalyses } from '../../server/analyses'
import { getOverview } from '../../server/overview'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { DiagnosticsBanner } from '../../components/dashboard/DiagnosticsBanner'
import type { WorkerAnalysis, WorkerDiagnostics } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/analyses')({ component: AnalysesPage })

const PAGE_SIZE = 50

function AnalysesPage() {
  const [items, setItems] = useState<WorkerAnalysis[]>([])
  const [diagnostics, setDiagnostics] = useState<WorkerDiagnostics | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(reset: boolean) {
    if (reset) setLoading(true)
    setError(null)
    try {
      const [result, overview] = await Promise.all([
        listAnalyses({
          data: { limit: PAGE_SIZE, cursor: reset ? undefined : (cursor ?? undefined) },
        }),
        getOverview(),
      ])
      setItems((previous) => (reset ? result.items : [...previous, ...result.items]))
      setDiagnostics(overview.diagnostics)
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

  if (loading) return <PageSkeleton label="Loading analyses" />

  return (
    <Panel
      title="Analyses"
      description="Every LLM verdict the worker has produced, whether or not it fired an action."
    >
      <DiagnosticsBanner diagnostics={diagnostics} />

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-(--sea-ink-soft)">No analyses have run yet.</p>
      ) : (
        <>
          <ul className="m-0 flex flex-col gap-2">
            {items.map((analysis) => (
              <li key={analysis.id} className="rounded-xl border border-(--line) bg-(--header-bg) px-4 py-2.5">
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-(--sea-ink)">
                  <FiredBadge analysis={analysis} />
                  <span className="font-semibold">{analysis.analysisConfigName}</span>
                  <span className="text-(--sea-ink-soft)">
                    {formatTime(analysis.analyzedAt)}
                  </span>
                </p>
                <p className="m-0 mt-0.5 text-xs text-(--sea-ink-soft)">
                  {analysis.message.chat.title}: “{truncate(analysis.message.text, 160)}”
                </p>
                <p className="m-0 mt-1 truncate font-mono text-xs text-(--sea-ink-soft)" title={JSON.stringify(analysis.rawResponse)}>
                  {truncate(JSON.stringify(analysis.rawResponse), 200)}
                </p>
                {analysis.actions.length > 0 && (
                  <p className="m-0 mt-1 text-xs text-(--sea-ink-soft)">
                    <span className="font-semibold text-(--sea-ink)">Fired</span>{' '}
                    {analysis.actions.map((action) => actionLabel(action)).join(' · ')}
                    {analysis.actions.some((action) => action.status === 'failed' && action.errorDetail) && (
                      <span className="mt-0.5 block text-red-500">
                        {analysis.actions.find((action) => action.status === 'failed' && action.errorDetail)?.errorDetail}
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => void load(false)}
              className="mt-4 rounded-full border border-(--line) bg-(--header-bg) px-5 py-2 text-sm font-semibold text-(--sea-ink) transition hover:border-(--lagoon)"
            >
              Load more
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

function FiredBadge({ analysis }: { analysis: WorkerAnalysis }) {
  if (!analysis.fired) {
    return <span className="rounded-full bg-[rgba(79,61,53,0.08)] px-2.5 py-0.5 text-xs font-semibold text-(--sea-ink-soft)">NO ACTION</span>
  }

  const statuses = analysis.actions.map((action) => action.status)
  const label = statuses.includes('pending')
    ? 'FIRED · PENDING'
    : statuses.every((status) => status === 'failed')
      ? 'FIRED · FAILED'
      : 'FIRED · SENT'

  const className =
    label === 'FIRED · FAILED'
      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      : label === 'FIRED · PENDING'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep)'

  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
}

function actionLabel(action: WorkerAnalysis['actions'][number]): string {
  return `${action.notifier.name} (${action.status.toUpperCase()}${action.retryCount > 0 ? ` · ${action.retryCount} retries` : ''})`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}