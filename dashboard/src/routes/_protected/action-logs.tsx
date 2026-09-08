import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    Clock3,
    RefreshCw,
    Search,
    Send,
    X,
} from 'lucide-react'

import { listActionLogs } from '../../server/actionLogs'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { WorkerActionLog, Json } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/action-logs')({ component: ActionLogsPage })

const PAGE_SIZE = 50

type StatusFilter = 'all' | 'sent' | 'pending' | 'failed'

function ActionLogsPage() {
    const [items, setItems] = useState<WorkerActionLog[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<WorkerActionLog | null>(null)

    async function load(reset: boolean, silent = false) {
        if (reset && !silent) setLoading(true)
        if (silent) setRefreshing(true)
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
            if (reset && !silent) setLoading(false)
            if (silent) setRefreshing(false)
        }
    }

    useEffect(() => {
        void load(true)
    }, [])

    useEffect(() => {
        if (!selected) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setSelected(null)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [selected])

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return items.filter((log) => {
            if (statusFilter !== 'all' && log.status !== statusFilter) return false
            if (!needle) return true
            return (
                log.notifier.name.toLowerCase().includes(needle) ||
                log.analysis.analysisConfigName.toLowerCase().includes(needle) ||
                log.analysis.message.chat.title.toLowerCase().includes(needle) ||
                (log.analysis.message.senderName ?? '').toLowerCase().includes(needle) ||
                log.analysis.message.text.toLowerCase().includes(needle)
            )
        })
    }, [items, statusFilter, query])

    const stats = useMemo(() => {
        let sent = 0
        let pending = 0
        let failed = 0
        for (const log of filtered) {
            if (log.status === 'sent') sent += 1
            else if (log.status === 'pending') pending += 1
            else failed += 1
        }
        return { total: filtered.length, sent, pending, failed }
    }, [filtered])

    if (loading) return <PageSkeleton label="Loading action logs" />

    return (
        <>
            <Panel
                title="Action logs"
                description="Every dispatch attempt the worker has made, with its outcome."
                action={
                    <button
                        type="button"
                        onClick={() => void load(true, true)}
                        disabled={refreshing}
                        aria-label="Refresh action logs"
                        title="Refresh action logs"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink) disabled:opacity-50"
                    >
                        <RefreshCw className={refreshing ? 'animate-spin' : 'h-4 w-4'} aria-hidden="true" />
                    </button>
                }
            >
                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

                {items.length === 0 ? (
                    <p className="text-sm text-(--sea-ink-soft)">No actions dispatched yet.</p>
                ) : (
                    <>
                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                            <StatCard icon={Send} label="Shown" value={stats.total} tone="accent" />
                            <StatCard icon={CheckCircle2} label="Sent" value={stats.sent} tone="positive" />
                            <StatCard icon={Clock3} label="Pending" value={stats.pending} tone="muted" />
                            <StatCard
                                icon={AlertTriangle}
                                label="Failed"
                                value={stats.failed}
                                tone={stats.failed > 0 ? 'danger' : 'positive'}
                            />
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-lg border border-(--line) p-0.5">
                                {(
                                    [
                                        ['all', 'All'],
                                        ['sent', 'Sent'],
                                        ['pending', 'Pending'],
                                        ['failed', 'Failed'],
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
                                    placeholder="Search by notifier, config, chat, sender or message…"
                                    className="w-full rounded-lg border border-(--line) bg-(--surface) py-1.5 pl-8 pr-3 text-sm text-(--sea-ink) outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <p className="text-sm text-(--sea-ink-soft)">No action logs match this filter.</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto rounded-xl border border-(--line)">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="text-left text-[11px] uppercase tracking-wider text-(--sea-ink-soft)">
                                                <th className="px-3 py-2.5 font-semibold">Status</th>
                                                <th className="px-3 py-2.5 font-semibold">Notifier</th>
                                                <th className="px-3 py-2.5 font-semibold">Config</th>
                                                <th className="px-3 py-2.5 font-semibold">Chat</th>
                                                <th className="px-3 py-2.5 font-semibold">Message</th>
                                                <th className="px-3 py-2.5 text-right font-semibold">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((log) => (
                                                <tr
                                                    key={log.id}
                                                    onClick={() => setSelected(log)}
                                                    className="cursor-pointer border-t border-(--line)/70 transition hover:bg-white/50 dark:hover:bg-zinc-800/60"
                                                    aria-label="Open action log details"
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <StatusBadge status={log.status} />
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-(--sea-ink)">
                                                        {log.notifier.name}
                                                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                                                            {log.notifier.type}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-(--sea-ink)">
                                                        {log.analysis.analysisConfigName}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-(--sea-ink)">
                                                        {log.analysis.message.chat.title}
                                                    </td>
                                                    <td className="max-w-60 truncate px-3 py-2.5 text-(--sea-ink-soft)">
                                                        “{log.analysis.message.text}”
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-(--sea-ink-soft)">
                                                        {relativeTime(log.sentAt ?? log.analysis.analyzedAt)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                <div
                    className="fixed inset-0 z-50 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Action log details"
                >
                    <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={() => setSelected(null)} />
                    <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-(--surface-strong) shadow-2xl">
                        <div className="flex items-center justify-between border-b border-(--line) px-5 py-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-(--sea-ink)">
                                <Send className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />
                                {selected.notifier.name}
                                <span className="text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                                    {selected.notifier.type}
                                </span>
                            </p>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                aria-label="Close"
                                className="grid h-8 w-8 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink)"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={selected.status} />
                                {selected.retryCount > 0 && (
                                    <span className="rounded-full bg-[rgba(79,61,53,0.08)] px-2.5 py-0.5 text-xs font-semibold text-(--sea-ink-soft)">
                                        {selected.retryCount} retr{selected.retryCount === 1 ? 'y' : 'ies'}
                                    </span>
                                )}
                            </div>
                            <p className="mt-2 m-0 text-xs text-(--sea-ink-soft)">
                                <Clock3 className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                                {selected.sentAt
                                    ? `Sent ${formatTime(selected.sentAt)}`
                                    : `Dispatched but not yet delivered (analyzed ${formatTime(selected.analysis.analyzedAt)})`}
                            </p>

                            {selected.status === 'failed' && selected.errorDetail && (
                                <p className="mt-3 m-0 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {selected.errorDetail}
                                </p>
                            )}

                            <SideSection title="Message">
                                <p className="m-0 text-[11px] font-semibold text-(--lagoon-deep)">
                                    {selected.analysis.message.chat.title}
                                    {selected.analysis.message.senderName
                                        ? ` · ${selected.analysis.message.senderName}`
                                        : ''}
                                </p>
                                <p className="m-0 mt-1 whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink)">
                                    {selected.analysis.message.text}
                                </p>
                            </SideSection>

                            <SideSection title="LLM verdict">
                                <p className="mb-1.5 m-0 flex items-center gap-1.5 text-xs text-(--sea-ink)">
                                    <Bot className="h-3.5 w-3.5 text-(--lagoon-deep)" aria-hidden="true" />
                                    {selected.analysis.analysisConfigName}
                                </p>
                                {verdictEntries(selected.analysis.rawResponse).length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {verdictEntries(selected.analysis.rawResponse).map(([key, value]) => (
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
                                        {typeof selected.analysis.rawResponse === 'string'
                                            ? selected.analysis.rawResponse
                                            : JSON.stringify(selected.analysis.rawResponse)}
                                    </p>
                                )}
                                <details className="mt-2 overflow-hidden rounded-xl border border-(--line)">
                                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-(--sea-ink-soft)">
                                        Raw JSON
                                    </summary>
                                    <pre className="m-0 max-h-64 overflow-auto border-t border-(--line) bg-(--surface) px-3 py-2 font-mono text-[11px] leading-relaxed text-(--sea-ink-soft)">
                                        {JSON.stringify(selected.analysis.rawResponse, null, 2)}
                                    </pre>
                                </details>
                            </SideSection>
                        </div>
                    </aside>
                </div>
            ) : null}
        </>
    )
}

function StatCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof Send
    label: string
    value: number
    tone: 'accent' | 'positive' | 'danger' | 'muted'
}) {
    const toneClass: Record<typeof tone, string> = {
        accent: 'bg-(--lagoon)/10 text-(--lagoon-deep)',
        positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
        muted: 'bg-[rgba(79,61,53,0.08)] text-(--sea-ink-soft)',
    }
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-(--line) bg-(--header-bg) px-3 py-2.5">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClass[tone]}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                    {label}
                </p>
                <p className="m-0 text-lg font-bold leading-tight text-(--sea-ink)">{value}</p>
            </div>
        </div>
    )
}

function SideSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-4">
            <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                {title}
            </h3>
            {children}
        </section>
    )
}

function StatusBadge({ status }: { status: WorkerActionLog['status'] }) {
    const styles: Record<WorkerActionLog['status'], string> = {
        sent: 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep)',
        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    }
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
            {status.toUpperCase()}
        </span>
    )
}

function verdictEntries(json: Json): [string, string][] {
    if (json === null || Array.isArray(json) || typeof json !== 'object') return []
    return Object.entries(json as Record<string, unknown>).map(([key, val]) => [
        key,
        typeof val === 'object' ? JSON.stringify(val) : String(val),
    ])
}

function relativeTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const seconds = Math.round((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}