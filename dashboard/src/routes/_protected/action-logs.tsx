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
} from 'lucide-react'

import { listActionLogs, deleteActionLog } from '../../server/actionLogs'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import { DetailsDrawer, DrawerSection } from '../../components/dashboard/DetailsDrawer'
import { ConfirmDialog } from '../../components/dashboard/ConfirmDialog'
import { StatCard } from '../../components/dashboard/StatCard'
import { StatusBadge } from '../../components/dashboard/StatusBadge'
import type { WorkerActionLog } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { formatDateTime, relativeTime } from '../../lib/helpers'

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
    const [pendingDelete, setPendingDelete] = useState<WorkerActionLog | null>(null)

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

    async function deleteActionLogRow(log: WorkerActionLog) {
        setError(null)
        try {
            await deleteActionLog({ data: { id: log.id } })
            setItems((previous) => previous.filter((row) => row.id !== log.id))
            setSelected((current) => (current?.id === log.id ? null : current))
        } catch (err) {
            setError(errorText(err))
        } finally {
            setPendingDelete(null)
        }
    }

    useEffect(() => {
        void load(true)
    }, [])

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return items.filter((log) => {
            if (statusFilter !== 'all' && log.status !== statusFilter) return false
            if (!needle) return true
            return (
                (log.recipient ?? '').toLowerCase().includes(needle) ||
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
                                <LogTable<WorkerActionLog>
                                    rows={filtered}
                                    rowKey={(log) => log.id}
                                    onRowClick={setSelected}
                                    onDelete={(log) => setPendingDelete(log)}
                                    rowAriaLabel={() => 'Open action log details'}
                                    columns={[
                                        { header: 'Status', cell: (log) => <StatusBadge status={log.status} /> },
                                        {
                                            header: 'Sent to',
                                            cell: (log) => (
                                                <span className="block max-w-40 truncate whitespace-nowrap text-(--sea-ink)">
                                                    {log.recipient ?? '—'}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Notifier',
                                            cell: (log) => (
                                                <span className="whitespace-nowrap font-semibold text-(--sea-ink)">
                                                    {log.notifier.name}
                                                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                                                        {log.notifier.type}
                                                    </span>
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Config',
                                            cell: (log) => (
                                                <span className="whitespace-nowrap text-(--sea-ink)">
                                                    {log.analysis.analysisConfigName}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Chat',
                                            cell: (log) => (
                                                <span className="whitespace-nowrap text-(--sea-ink)">
                                                    {log.analysis.message.chat.title}
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Message',
                                            hiddenOnMobile: true,
                                            cell: (log) => (
                                                <span className="block max-w-48 truncate text-(--sea-ink-soft)">
                                                    “{log.analysis.message.text}”
                                                </span>
                                            ),
                                        },
                                        {
                                            header: 'Time',
                                            align: 'right',
                                            cell: (log) => (
                                                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)">
                                                    {relativeTime(log.sentAt ?? log.analysis.analyzedAt)}
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
                    ariaLabel="Action log details"
                    icon={<Send className="h-4 w-4 text-(--lagoon-deep)" aria-hidden="true" />}
                    title={selected.notifier.name}
                    subtitle={
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                            {selected.notifier.type}
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
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
                            ? `Sent ${formatDateTime(selected.sentAt)}`
                            : `Dispatched but not yet delivered (analyzed ${formatDateTime(selected.analysis.analyzedAt)})`}
                    </p>

                    {selected.status === 'failed' && selected.errorDetail && (
                        <p className="mt-3 m-0 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {selected.errorDetail}
                        </p>
                    )}

                    <DrawerSection title="Sent to">
                        <p className="m-0 flex items-center gap-1.5 rounded-xl border border-(--line) bg-(--surface) px-3 py-2 text-sm font-semibold text-(--sea-ink)">
                            <Send className="h-3.5 w-3.5 shrink-0 text-(--lagoon-deep)" aria-hidden="true" />
                            {selected.recipient ?? 'Unknown'}
                        </p>
                    </DrawerSection>

                    <DrawerSection title="What was sent">
                        {selected.body ? (
                            <pre className="m-0 max-h-72 overflow-auto rounded-xl border border-(--line) bg-(--surface) px-3 py-2 font-mono text-[11px] leading-relaxed text-(--sea-ink)">
                                {selected.body}
                            </pre>
                        ) : (
                            <p className="m-0 text-xs text-(--sea-ink-soft)">
                                No payload captured for this dispatch.
                            </p>
                        )}
                    </DrawerSection>

                    <DrawerSection title="Trigger">
                        <p className="m-0 flex items-center gap-1.5 text-xs text-(--sea-ink)">
                            <Bot className="h-3.5 w-3.5 shrink-0 text-(--lagoon-deep)" aria-hidden="true" />
                            <span className="font-semibold text-(--lagoon-deep)">
                                {selected.analysis.message.chat.title}
                            </span>
                            <span className="text-(--sea-ink-soft)">·</span>
                            <span>{selected.analysis.analysisConfigName}</span>
                            <span className="text-(--sea-ink-soft)">·</span>
                            <span className="text-(--sea-ink-soft)">
                                {formatDateTime(selected.analysis.analyzedAt)}
                            </span>
                        </p>
                    </DrawerSection>
                </DetailsDrawer>
            ) : null}

            {pendingDelete ? (
                <ConfirmDialog
                    title="Delete action log?"
                    message={`This permanently deletes the "${pendingDelete.analysis.analysisConfigName}" dispatch to ${pendingDelete.notifier.name} (${pendingDelete.recipient ?? 'no recipient'}).`}
                    confirmLabel="Delete log"
                    onConfirm={() => void deleteActionLogRow(pendingDelete)}
                    onCancel={() => setPendingDelete(null)}
                />
            ) : null}
        </>
    )
}