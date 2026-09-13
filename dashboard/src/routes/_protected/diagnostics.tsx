import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Clock3, Inbox, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
    clearDiagnostics,
    deleteDiagnostic,
    getDiagnosticsStatus,
    listDiagnostics,
} from '../../server/diagnostics'
import { connectRealtime } from '../../client/socket'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import type { LogTableColumn } from '../../components/dashboard/LogTable'
import { DetailsDrawer, DrawerSection } from '../../components/dashboard/DetailsDrawer'
import { ConfirmDialog } from '../../components/dashboard/ConfirmDialog'
import { BulkSelectionBar } from '../../components/dashboard/BulkSelectionBar'
import type { WorkerDiagnosticEntry, WorkerDiagnosticsStatus } from '../../lib/types'
import { errorText } from '../../lib/utils'
import { formatDateTime, formatTime } from '../../lib/helpers'

export const Route = createFileRoute('/_protected/diagnostics')({ component: DiagnosticsPage })

const SUBSYSTEM_KEYS: { key: string; title: string }[] = [
    { key: 'system.startup', title: 'Startup' },
    { key: 'db.connection', title: 'Database' },
    { key: 'telegram.session', title: 'Telegram session' },
    { key: 'telegram.listener', title: 'Telegram connection' },
    { key: 'telegram.scan', title: 'Chat scan' },
    { key: 'login.flow', title: 'Telegram login' },
    { key: 'llm.analyze', title: 'Analysis' },
    { key: 'llm.failover', title: 'LLM failover' },
    { key: 'analysis.config', title: 'Analysis config' },
    { key: 'notifier.dispatch', title: 'Notifier' },
]

const TABS = [
    { value: 'errors', label: 'Errors' },
    { value: 'warnings', label: 'Warnings' },
    { value: 'all', label: 'All' },
] as const

type Tab = (typeof TABS)[number]['value']

const PAGE_SIZE = 50
const MAX_ITEMS = 200

function subsystemTitle(key: string): string {
    const match = SUBSYSTEM_KEYS.find((row) => row.key === key)
    return match ? match.title : key
}

function DiagnosticsPage() {
    const [status, setStatus] = useState<WorkerDiagnosticsStatus | null>(null)
    const [tab, setTab] = useState<Tab>('errors')
    const [query, setQuery] = useState('')
    const [items, setItems] = useState<WorkerDiagnosticEntry[]>([])
    const [selected, setSelected] = useState<WorkerDiagnosticEntry | null>(null)
    const [pendingDelete, setPendingDelete] = useState<WorkerDiagnosticEntry | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
    const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
    const [pendingClearAll, setPendingClearAll] = useState(false)
    const [listCursor, setListCursor] = useState<string | null>(null)
    const [hasMoreList, setHasMoreList] = useState(false)
    const [loadingList, setLoadingList] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const hasMoreRef = useRef(false)
    const tabRef = useRef<Tab>('errors')

    useEffect(() => {
        hasMoreRef.current = hasMoreList
    }, [hasMoreList])

    async function fetchStatus() {
        try {
            setStatus(await getDiagnosticsStatus())
        } catch (err) {
            setError(errorText(err))
        }
    }

    async function fetchPage(reset: boolean, tabValue: Tab, cursor?: string) {
        if (reset) setLoadingList(true)
        setError(null)
        try {
            const severity = tabValue === 'all' ? undefined : tabValue
            const result = await listDiagnostics({
                data: {
                    limit: PAGE_SIZE,
                    cursor: reset ? undefined : cursor,
                    severity,
                },
            })
            setItems((previous) => {
                const next = (reset ? result.items : [...previous, ...result.items]).slice(0, MAX_ITEMS)
                const seen = new Set<string>()
                return next.filter((entry) => {
                    if (seen.has(entry.id)) return false
                    seen.add(entry.id)
                    return true
                })
            })
            setListCursor(result.nextCursor)
            setHasMoreList(result.hasMore)
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (reset) setLoadingList(false)
        }
    }

    async function refresh() {
        setRefreshing(true)
        try {
            await Promise.all([fetchStatus(), fetchPage(true, tab)])
        } finally {
            setRefreshing(false)
        }
    }

    function changeTab(next: Tab) {
        if (next === tab) return
        tabRef.current = next
        setTab(next)
        setQuery('')
        setSelectedIds(new Set())
        setSelected(null)
        void fetchPage(true, next)
    }

    useEffect(() => {
        void fetchStatus()
        void fetchPage(true, 'errors')
        const unsubscribe = connectRealtime({
            onDiagnosticsUpdate: () => {
                void fetchStatus()
                if (!hasMoreRef.current) void fetchPage(true, tabRef.current)
            },
        })
        return unsubscribe
    }, [])

    async function deleteRow(entry: WorkerDiagnosticEntry) {
        setDeletingId(entry.id)
        try {
            await deleteDiagnostic({ data: { id: entry.id } })
            setItems((previous) => previous.filter((row) => row.id !== entry.id))
            setSelectedIds((current) => {
                if (!current.has(entry.id)) return current
                const next = new Set(current)
                next.delete(entry.id)
                return next
            })
            setSelected((current) => (current?.id === entry.id ? null : current))
            toast.success('Diagnostic entry deleted.')
            void fetchStatus()
        } catch (err) {
            toast.error(errorText(err))
        } finally {
            setDeletingId(null)
            setPendingDelete(null)
        }
    }

    async function deleteRows(list: WorkerDiagnosticEntry[]) {
        setDeletingId('bulk')
        try {
            for (const entry of list) {
                await deleteDiagnostic({ data: { id: entry.id } })
            }
            const removed = new Set(list.map((entry) => entry.id))
            setItems((previous) => previous.filter((row) => !removed.has(row.id)))
            setSelectedIds(new Set())
            setSelected((current) => (current && removed.has(current.id) ? null : current))
            toast.success(`Deleted ${list.length} diagnostic entr${list.length === 1 ? 'y' : 'ies'}.`)
            void fetchStatus()
        } catch (err) {
            toast.error(errorText(err))
        } finally {
            setDeletingId(null)
            setPendingBulkDelete(false)
        }
    }

    async function clearAll() {
        setDeletingId('all')
        try {
            await clearDiagnostics()
            setItems([])
            setListCursor(null)
            setHasMoreList(false)
            setSelectedIds(new Set())
            setSelected(null)
            toast.success('Diagnostics log cleared.')
            void fetchStatus()
        } catch (err) {
            toast.error(errorText(err))
        } finally {
            setDeletingId(null)
            setPendingClearAll(false)
        }
    }

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return items
        return items.filter(
            (entry) =>
                entry.key.toLowerCase().includes(q) ||
                entry.message.toLowerCase().includes(q) ||
                subsystemTitle(entry.key).toLowerCase().includes(q),
        )
    }, [items, query])

    const selectedEntries = useMemo(
        () => filteredItems.filter((entry) => selectedIds.has(entry.id)),
        [filteredItems, selectedIds],
    )

    if (loadingList && status === null) {
        return <PageSkeleton label="Loading diagnostics" />
    }

    const columns: LogTableColumn<WorkerDiagnosticEntry>[] = [
        {
            header: 'Subsystem',
            cell: (entry) => (
                <span className="whitespace-nowrap font-semibold text-(--sea-ink)">
                    {subsystemTitle(entry.key)}
                </span>
            ),
        },
        {
            header: 'Key',
            hiddenOnMobile: true,
            cell: (entry) => (
                <span className="whitespace-nowrap font-mono text-xs text-(--sea-ink-soft)">{entry.key}</span>
            ),
        },
        {
            header: 'Severity',
            cell: (entry) => <SeverityBadge entry={entry} />,
        },
        {
            header: 'Message',
            cell: (entry) => (
                <span className="block max-w-72 truncate text-xs text-(--sea-ink-soft)" title={entry.message}>
                    {entry.message}
                </span>
            ),
        },
        {
            header: 'Time',
            align: 'right',
            cell: (entry) => (
                <span
                    className="whitespace-nowrap text-xs text-(--sea-ink-soft)"
                    title={formatDateTime(entry.createdAt)}
                >
                    {formatTime(entry.createdAt)}
                </span>
            ),
        },
    ]

    const emptyTitle = query
        ? 'No matches'
        : tab === 'all'
            ? 'Log is empty'
            : tab === 'errors'
                ? 'No errors recorded'
                : 'No warnings recorded'

    const emptyBody = query
        ? `Nothing matches "${query}" in the diagnostics loaded so far.`
        : tab === 'all'
            ? 'Error and warning entries from the worker will appear here as they are reported.'
            : `The ${tab === 'errors' ? 'Error' : 'Warning'} tab is empty. Use the "All" tab to browse the full log.`

    return (
        <>
            <section className="island-shell overflow-hidden rounded-2xl p-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--line) px-4 py-3.5 sm:px-5 sm:py-4">
                    <div>
                        <h2 className="m-0 text-base font-semibold text-(--sea-ink)">Diagnostics log</h2>
                        <p className="m-0 mt-0.5 text-sm text-(--sea-ink-soft)">
                            Append-only log of every worker error and warning. Entries are kept until you delete them — nothing clears automatically.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => void refresh()}
                            disabled={refreshing}
                            className="app-primary-button"
                            aria-label="Refresh diagnostics"
                        >
                            <RefreshCw className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={() => setPendingClearAll(true)}
                            disabled={loadingList || items.length === 0}
                            aria-label="Clear diagnostics log"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 px-3.5 text-xs font-semibold text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Clear log
                        </button>
                    </div>
                </div>

                {error && <p className="border-b border-(--line) px-5 py-2 text-sm text-red-500">{error}</p>}

                <div className="px-4 pb-5 sm:px-5">
                    <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-(--line) bg-(--surface-strong) px-3.5 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--sea-ink)">
                            <StatusDot status={status?.status} />
                            {statusLabel(status?.status)}
                        </span>
                        <span className="text-xs text-(--sea-ink-soft)">
                            {status?.updatedAt
                                ? `Last event at ${formatDateTime(status.updatedAt)}`
                                : 'No issues in the last 15 minutes'}
                            {' — live via socket'}
                        </span>
                        {status?.message ? (
                            <span className="min-w-0 flex-1 truncate text-xs text-(--sea-ink-soft)" title={status.message}>
                                {status.message}
                            </span>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div
                            className="inline-flex items-center rounded-full border border-(--line) bg-(--surface-strong) p-0.5"
                            role="tablist"
                            aria-label="Filter by severity"
                        >
                            {TABS.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === value}
                                    onClick={() => changeTab(value)}
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                        tab === value
                                            ? 'bg-(--lagoon-deep) text-white dark:bg-(--lagoon) dark:text-[#4F3D35]'
                                            : 'text-(--sea-ink-soft) hover:text-(--sea-ink)'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="relative min-w-40 flex-1 sm:max-w-64">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--sea-ink-soft)"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search diagnostics…"
                                aria-label="Search diagnostics"
                                className="w-full rounded-full border border-(--line) bg-(--surface-strong) py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-(--lagoon) dark:text-zinc-100"
                            />
                        </div>
                    </div>

                    {selectedEntries.length > 0 ? (
                        <div className="mt-3">
                            <BulkSelectionBar
                                count={selectedEntries.length}
                                noun={selectedEntries.length === 1 ? 'diagnostic' : 'diagnostics'}
                                confirmLabel="Delete selected"
                                onClear={() => setSelectedIds(new Set())}
                                onDelete={() => setPendingBulkDelete(true)}
                            />
                        </div>
                    ) : null}

                    {loadingList ? (
                        <p className="py-6 text-center text-sm text-(--sea-ink-soft)">Loading diagnostics…</p>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-(--lagoon)/15 text-(--sea-ink) dark:text-(--lagoon)">
                                <Inbox className="h-6 w-6" />
                            </div>
                            <h3 className="font-semibold text-sm text-(--sea-ink) dark:text-zinc-100">
                                {emptyTitle}
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-(--sea-ink-soft) dark:text-zinc-400">
                                {emptyBody}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-3">
                                <LogTable<WorkerDiagnosticEntry>
                                    rows={filteredItems}
                                    rowKey={(entry) => entry.id}
                                    onRowClick={setSelected}
                                    onDelete={(entry) => setPendingDelete(entry)}
                                    selectable
                                    selectedKeys={selectedIds}
                                    onSelectedKeysChange={setSelectedIds}
                                    deletingKey={deletingId}
                                    rowAriaLabel={() => 'Open diagnostic details'}
                                    columns={columns}
                                />
                            </div>
                            {hasMoreList && (
                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => void fetchPage(false, tab, listCursor ?? undefined)}
                                        disabled={deletingId !== null}
                                        className="rounded-full border border-(--line) bg-(--surface-strong) px-5 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200"
                                    >
                                        Load older
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {selected ? (
                <DetailsDrawer
                    ariaLabel={`Diagnostic ${selected.key}`}
                    icon={<SeverityBadge entry={selected} />}
                    title={subsystemTitle(selected.key)}
                    subtitle={
                        <span className="whitespace-nowrap font-mono text-[10px] text-(--sea-ink-soft)">
                            {selected.key}
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
                    <DrawerSection title="Details">
                        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink)">
                            {selected.message}
                        </p>
                    </DrawerSection>

                    {selected.context ? (
                        <DrawerSection title="Context">
                            <div className="rounded-xl border border-(--line) bg-(--surface) p-3">
                                <p className="m-0 text-[11px] font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                                    {selected.context.chatTitle}
                                </p>
                                <p className="m-0 mt-1 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-(--sea-ink-soft)">
                                    {selected.context.messageText}
                                </p>
                            </div>
                        </DrawerSection>
                    ) : null}

                    <DrawerSection title="Reported">
                        <p className="m-0 flex items-center gap-1.5 text-xs text-(--sea-ink-soft)">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDateTime(selected.createdAt)}
                        </p>
                    </DrawerSection>
                </DetailsDrawer>
            ) : null}

            {pendingDelete ? (
                <ConfirmDialog
                    title="Delete diagnostic entry?"
                    message={`This permanently deletes the "${subsystemTitle(pendingDelete.key)}" entry from the log. It cannot be undone.`}
                    confirmLabel="Delete entry"
                    loading={deletingId === pendingDelete.id}
                    onConfirm={() => void deleteRow(pendingDelete)}
                    onCancel={() => setPendingDelete(null)}
                />
            ) : null}

            {pendingBulkDelete && selectedEntries.length > 0 ? (
                <ConfirmDialog
                    title={`Delete ${selectedEntries.length} ${selectedEntries.length === 1 ? 'diagnostic entry' : 'diagnostic entries'}?`}
                    message={`This permanently deletes ${selectedEntries.length} ${selectedEntries.length === 1 ? 'entry' : 'entries'} from the log. It cannot be undone.`}
                    confirmLabel={`Delete ${selectedEntries.length}`}
                    loading={deletingId !== null}
                    onConfirm={() => void deleteRows(selectedEntries)}
                    onCancel={() => setPendingBulkDelete(false)}
                />
            ) : null}

            {pendingClearAll ? (
                <ConfirmDialog
                    title="Clear diagnostics log?"
                    message="This permanently deletes every recorded diagnostic entry. It cannot be undone."
                    confirmLabel="Clear all"
                    loading={deletingId === 'all'}
                    onConfirm={() => void clearAll()}
                    onCancel={() => setPendingClearAll(false)}
                />
            ) : null}
        </>
    )
}

function SeverityBadge({ entry }: { entry: WorkerDiagnosticEntry }) {
    const isError = entry.severity === 'error'
    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isError
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}
        >
            {isError ? 'Error' : 'Warning'}
        </span>
    )
}

function StatusDot({ status }: { status: WorkerDiagnosticsStatus['status'] | undefined }) {
    if (status === 'error') return <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
    if (status === 'warning') return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
    return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
}

function statusLabel(status: WorkerDiagnosticsStatus['status'] | undefined): string {
    if (status === 'ok') return 'Healthy'
    if (status === 'warning') return 'Attention'
    if (status === 'error') return 'Errors'
    return 'Unknown'
}