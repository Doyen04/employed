import { useMemo, useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    Clock3,
    RefreshCw,
    Search,
    Send,
    XCircle,
} from 'lucide-react'

import { listAnalyses } from '../../server/analyses'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import { DetailsDrawer, DrawerSection } from '../../components/dashboard/DetailsDrawer'
import { StatCard } from '../../components/dashboard/StatCard'
import { StatusBadge } from '../../components/dashboard/StatusBadge'
import type { WorkerAnalysis } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { formatDateTime, relativeTime, verdictEntries, verdictSummary } from '../../lib/helpers'

export const Route = createFileRoute('/_protected/analyses')({ component: AnalysesPage })

const PAGE_SIZE = 50

type StatusFilter = 'all' | 'fired' | 'noaction'

function AnalysesPage() {
    const [items, setItems] = useState<WorkerAnalysis[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<WorkerAnalysis | null>(null)

    async function load(reset: boolean, silent = false) {
        if (reset && !silent) setLoading(true)
        if (silent) setRefreshing(true)
        setError(null)
        try {
            const result = await listAnalyses({
                data: { limit: PAGE_SIZE, cursor: reset ? undefined : (cursor ?? undefined) },
            })
            setItems((previous) => (reset ? result.items : [...previous, ...result.items]))
            setCursor(result.nextCursor)
            setHasMore(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset && !silent) setLoading(false)
            if (silent) setRefreshing(false)
        }
    }

useEffect(() => {
    void load(true)
  }, [])

  const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return items.filter((analysis) => {
            if (statusFilter === 'fired' && !analysis.fired) return false
            if (statusFilter === 'noaction' && analysis.fired) return false
            if (!needle) return true
            return (
                analysis.analysisConfigName.toLowerCase().includes(needle) ||
                analysis.message.chat.title.toLowerCase().includes(needle) ||
                (analysis.message.senderName ?? '').toLowerCase().includes(needle) ||
                analysis.message.text.toLowerCase().includes(needle)
            )
        })
    }, [items, statusFilter, query])

    const stats = useMemo(() => {
        const fired = filtered.filter((analysis) => analysis.fired)
        const failedDispatches = filtered.reduce(
            (total, analysis) =>
                total + analysis.actions.filter((action) => action.status === 'failed').length,
            0,
        )
        return {
            total: filtered.length,
            fired: fired.length,
            noAction: filtered.length - fired.length,
            failedDispatches,
        }
    }, [filtered])

    if (loading) return <PageSkeleton label="Loading analyses" />

    return (
        <>
            <Panel
                title="Analyses"
                description="Every LLM verdict the worker has produced, whether or not it fired an action."
                action={
                    <button
                        type="button"
                        onClick={() => void load(true, true)}
                        disabled={refreshing}
                        aria-label="Refresh analyses"
                        title="Refresh analyses"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink) disabled:opacity-50 md:h-8 md:w-8"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </button>
                }
            >
                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

                {items.length === 0 ? (
                    <p className="text-sm text-(--sea-ink-soft)">No analyses have run yet.</p>
                ) : (
                    <>
                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                            <StatCard icon={Bot} label="Shown" value={stats.total} tone="accent" />
                            <StatCard icon={CheckCircle2} label="Fired" value={stats.fired} tone="positive" />
                            <StatCard icon={XCircle} label="No action" value={stats.noAction} tone="muted" />
                            <StatCard
                                icon={AlertTriangle}
                                label="Failed dispatches"
                                value={stats.failedDispatches}
                                tone={stats.failedDispatches > 0 ? 'danger' : 'positive'}
                            />
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-lg border border-(--line) p-0.5">
                                {(
                                    [
                                        ['all', 'All'],
                                        ['fired', 'Fired'],
                                        ['noaction', 'No action'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStatusFilter(value)}
                                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${statusFilter === value
                                                ? 'bg-(--lagoon) text-white'
                                                : 'text-(--sea-ink-soft) hover:bg-white/50 dark:hover:bg-zinc-800'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative min-w-52 flex-1">
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--sea-ink-soft)"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search analyses…"
                                    className="w-full rounded-lg border border-(--line) bg-(--surface) py-1.5 pl-8 pr-3 text-sm text-(--sea-ink) outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <p className="text-sm text-(--sea-ink-soft)">No analyses match this filter.</p>
                        ) : (
                            <>
                                <LogTable<WorkerAnalysis>
                                    rows={filtered}
                                    rowKey={(analysis) => analysis.id}
                                    onRowClick={setSelected}
                                    rowAriaLabel={() => 'Open analysis details'}
                                    columns={[
                                        { header: 'Status', cell: (analysis) => <FiredBadge analysis={analysis} /> },
                                        {
                                            header: 'Config',
                                            cell: (analysis) => (
                                                <span className="whitespace-nowrap font-semibold text-(--sea-ink)">
                                                    {analysis.analysisConfigName}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Analyzed by',
                                            hiddenOnMobile: true,
                                            cell: (analysis) => (
                                                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)">
                                                    {analysis.provider
                                                        ? [analysis.provider, analysis.model].filter(Boolean).join(' · ')
                                                        : '—'}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Chat',
                                            cell: (analysis) => (
                                                <span className="whitespace-nowrap text-(--sea-ink)">
                                                    {analysis.message.chat.title}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Message',
                                            cell: (analysis) => (
                                                <span className="block max-w-60 truncate text-(--sea-ink-soft)">
                                                    “{analysis.message.text}”
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Verdict',
                                            hiddenOnMobile: true,
                                            cell: (analysis) => (
                                                <span className="block max-w-48 truncate font-mono text-xs text-(--sea-ink-soft)">
                                                    {verdictSummary(analysis.rawResponse)}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Time',
                                            align: 'right',
                                            cell: (analysis) => (
                                                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)">
                                                    {relativeTime(analysis.analyzedAt)}
                                                </span>
                                            ),
                                        },
                                    ]}
                                />
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
                    </>
                )}
            </Panel>

{selected ? (
        <DetailsDrawer
          ariaLabel="Analysis details"
          icon={<Bot className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />}
          title={selected.analysisConfigName}
          onClose={() => setSelected(null)}
        >
          <FiredBadge analysis={selected} />
          <p className="mt-2 m-0 text-xs text-(--sea-ink-soft)" title={formatDateTime(selected.analyzedAt)}>
            <Clock3 className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
            Analyzed {formatDateTime(selected.analyzedAt)}
            {selected.provider
              ? <span className="font-semibold text-(--sea-ink-soft)"> · by {[selected.provider, selected.model].filter(Boolean).join(' · ')}</span>
              : null}
          </p>

          <DrawerSection title="Message">
            <p className="m-0 text-[11px] font-semibold text-(--lagoon-deep)">
              {selected.message.chat.title}
              {selected.message.senderName ? ` · ${selected.message.senderName}` : ''}
            </p>
            <p className="m-0 mt-1 whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink)">
              {selected.message.text}
            </p>
          </DrawerSection>

          <DrawerSection title="LLM verdict">
            {verdictEntries(selected.rawResponse).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {verdictEntries(selected.rawResponse).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-md border border-(--line) bg-(--surface) px-2 py-1 font-mono text-[11px] text-(--sea-ink)"
                  >
                    <span className="text-(--sea-ink-soft)">{key}</span>{' '}
                    <span className="font-semibold">{value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="m-0 font-mono text-[11px] text-(--sea-ink)">
                {typeof selected.rawResponse === 'string'
                  ? selected.rawResponse
                  : JSON.stringify(selected.rawResponse)}
              </p>
            )}
            <details className="mt-2 overflow-hidden rounded-xl border border-(--line)">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-(--sea-ink-soft)">
                Raw JSON
              </summary>
              <pre className="m-0 max-h-64 overflow-auto border-t border-(--line) bg-(--surface) px-3 py-2 font-mono text-[11px] leading-relaxed text-(--sea-ink-soft)">
                {JSON.stringify(selected.rawResponse, null, 2)}
              </pre>
            </details>
          </DrawerSection>

          <DrawerSection title="Action">
            {selected.actions.length === 0 ? (
              <p className="m-0 text-xs text-(--sea-ink-soft)">
                This verdict matched no active rule, so no action was dispatched.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {selected.actions.map((action) => (
                  <div key={action.id} className="rounded-xl border border-(--line) bg-(--surface) p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-(--sea-ink)">
                        <Send className="h-3.5 w-3.5 text-(--lagoon-deep)" aria-hidden="true" />
                        {action.notifier.name}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                          {action.notifier.type}
                        </span>
                      </p>
                       <StatusBadge status={action.status} retryCount={action.retryCount} />
                    </div>
                    {action.sentAt && (
                      <p className="m-0 mt-1.5 text-xs text-(--sea-ink-soft)">
                        Sent {formatDateTime(action.sentAt)}
                      </p>
                    )}
                    {action.errorDetail && (
                      <p className="m-0 mt-1.5 flex items-start gap-1.5 text-xs text-red-500">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {action.errorDetail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>
        </DetailsDrawer>
      ) : null}
        </>
    )
}

function FiredBadge({ analysis }: { analysis: WorkerAnalysis }) {
    if (!analysis.fired) {
        return (
            <span className="whitespace-nowrap rounded-full bg-[rgba(79,61,53,0.08)] px-2.5 py-0.5 text-xs font-semibold text-(--sea-ink-soft)">
                NO ACTION
            </span>
        )
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

    return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
}