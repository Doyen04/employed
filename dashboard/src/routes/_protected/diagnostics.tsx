import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react'

import { getDiagnostics } from '../../server/diagnostics'
import { connectRealtime } from '../../client/socket'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { LogTable } from '../../components/dashboard/LogTable'
import type { LogTableColumn } from '../../components/dashboard/LogTable'
import { DetailsDrawer, DrawerSection } from '../../components/dashboard/DetailsDrawer'
import type { WorkerDiagnosticIssue, WorkerDiagnostics } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/diagnostics')({ component: DiagnosticsPage })

const SUBSYSTEM_KEYS: { key: string; title: string }[] = [
    { key: 'system.startup', title: 'Startup' },
    { key: 'db.connection', title: 'Database' },
    { key: 'telegram.session', title: 'Telegram session' },
    { key: 'telegram.listener', title: 'Telegram connection' },
    { key: 'telegram.scan', title: 'Chat scan' },
    { key: 'login.flow', title: 'Telegram login' },
    { key: 'llm.analyze', title: 'Analysis' },
    { key: 'analysis.config', title: 'Analysis config' },
    { key: 'notifier.dispatch', title: 'Notifier' },
]

type SubsystemRow = { key: string; title: string; issue: WorkerDiagnosticIssue | null }

function DiagnosticsPage() {
    const [state, setState] = useState<WorkerDiagnostics | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<SubsystemRow | null>(null)

    async function load(silent = false) {
        if (silent) setRefreshing(true)
        else setLoading(true)
        setError(null)
        try {
            setState(await getDiagnostics())
        } catch (err) {
            setError(errorText(err))
        } finally {
            if (silent) setRefreshing(false)
            else setLoading(false)
        }
    }

    useEffect(() => {
        void load()
        const unsubscribe = connectRealtime({
            onDiagnosticsUpdate: (payload) => {
                setState(payload as WorkerDiagnostics)
                setError(null)
            },
        })
        return unsubscribe
    }, [])

    if (loading) return <PageSkeleton label="Loading diagnostics" />

    const issues = state?.issues ?? []
    const status = state?.status ?? 'ok'
    const updatedAt = state?.updatedAt ?? null

    const issueByKey = new Map<string, WorkerDiagnosticIssue>()
    for (const issue of issues) issueByKey.set(issue.key, issue)

    const knownRows: SubsystemRow[] = SUBSYSTEM_KEYS.map(({ key, title }) => ({
        key,
        title,
        issue: issueByKey.get(key) ?? null,
    }))
    const extraRows: SubsystemRow[] = [...issueByKey.keys()]
        .filter((key) => !SUBSYSTEM_KEYS.some((row) => row.key === key))
        .map((key) => ({ key, title: key, issue: issueByKey.get(key)! }))
    const rows: SubsystemRow[] = [...knownRows, ...extraRows]

    const columns: LogTableColumn<SubsystemRow>[] = [
        {
            header: 'Subsystem',
            cell: (row) => (
                <span className="whitespace-nowrap font-semibold text-(--sea-ink)">{row.title}</span>
            ),
        },
        {
            header: 'Key',
            hiddenOnMobile: true,
            cell: (row) => (
                <span className="whitespace-nowrap font-mono text-xs text-(--sea-ink-soft)">{row.key}</span>
            ),
        },
        {
            header: 'Status',
            cell: (row) => <SubsystemBadge issue={row.issue} />,
        },
        {
            header: 'Message',
            cell: (row) => (
                <span
                    className="block max-w-72 truncate text-xs text-(--sea-ink-soft)"
                    title={row.issue ? row.issue.message : undefined}
                >
                    {row.issue ? row.issue.message : '—'}
                </span>
            ),
        },
        {
            header: 'Updated',
            align: 'right',
            cell: (row) => (
                <span className="whitespace-nowrap text-xs text-(--sea-ink-soft)">
                    {row.issue ? formatTime(row.issue.updatedAt) : '—'}
                </span>
            ),
        },
    ]

    const errorCount = issues.filter((issue) => issue.severity === 'error').length
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length
    const healthyCount = rows.length - issueByKey.size

    return (
        <>
            <Panel
                title="System diagnostics"
                description="Live health of every worker subsystem. Issues self-clear when the failing subsystem recovers."
                action={
                    <button
                        type="button"
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        aria-label="Refresh diagnostics"
                        title="Refresh diagnostics"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink) disabled:opacity-50"
                    >
                        <RefreshCw className={refreshing ? 'animate-spin' : 'h-4 w-4'} aria-hidden="true" />
                    </button>
                }
            >
                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

                {state !== null ? (
                    <>
                        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                            <StatusCard label="Status" value={statusLabel(status)} tone={statusTone(status)} />
                            <StatusCard
                                icon={CheckCircle2}
                                label="Healthy systems"
                                value={healthyCount}
                                tone="positive"
                            />
                            <StatusCard icon={AlertTriangle} label="Warnings" value={warningCount} tone="warning" />
                            <StatusCard icon={XCircle} label="Errors" value={errorCount} tone="error" />
                        </div>

                        <p className="mb-4 text-xs text-(--sea-ink-soft)">
                            {updatedAt ? `Last change reported at ${formatTime(updatedAt)}` : 'No changes reported yet'}
                            {' — live via socket'}
                        </p>

                        {issues.length === 0 && (
                            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700/40 dark:bg-emerald-900/20">
                                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="m-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                        All systems operational
                                    </p>
                                    <p className="m-0 text-xs text-emerald-600/90 dark:text-emerald-300/80">
                                        Every subsystem is reporting healthy.
                                    </p>
                                </div>
                            </div>
                        )}

                        <LogTable
                            rows={rows}
                            rowKey={(row) => row.key}
                            onRowClick={setSelected}
                            rowAriaLabel={() => 'Open subsystem details'}
                            columns={columns}
                        />

                        <details className="mt-6">
                            <summary className="cursor-pointer select-none text-xs font-semibold text-(--sea-ink-soft) transition hover:text-(--sea-ink)">
                                Raw response
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-xl border border-(--line) bg-(--surface-strong) p-3 text-[11px] leading-relaxed text-(--sea-ink-soft)">
                                {JSON.stringify(state, null, 2)}
                            </pre>
                        </details>
                    </>
                ) : null}
            </Panel>

            {selected ? (
                <DetailsDrawer
                    ariaLabel={`Diagnostics for ${selected.title}`}
                    icon={
                        <SubsystemBadge issue={selected.issue} />
                    }
                    title={selected.title}
                    subtitle={
                        <span className="whitespace-nowrap font-mono text-[10px] text-(--sea-ink-soft)">
                            {selected.key}
                        </span>
                    }
                    onClose={() => setSelected(null)}
                >
                    {selected.issue ? (
                        <>
                            <DrawerSection title="Details">
                                <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-(--sea-ink)">
                                    {selected.issue.message}
                                </p>
                            </DrawerSection>

                            {selected.issue.context ? (
                                <DrawerSection title="Context">
                                    <div className="rounded-xl border border-(--line) bg-(--surface) p-3">
                                        <p className="m-0 text-[11px] font-semibold text-(--lagoon-deep) dark:text-(--lagoon)">
                                            {selected.issue.context.chatTitle}
                                        </p>
                                        <p className="m-0 mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-(--sea-ink-soft)">
                                            {selected.issue.context.messageText}
                                        </p>
                                    </div>
                                </DrawerSection>
                            ) : null}

                            <DrawerSection title="Last reported">
                                <p className="m-0 flex items-center gap-1.5 text-xs text-(--sea-ink-soft)">
                                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                    {formatTime(selected.issue.updatedAt)}
                                </p>
                            </DrawerSection>
                        </>
                    ) : (
                        <DrawerSection title="Details">
                            <p className="m-0 text-xs text-(--sea-ink-soft)">
                                This subsystem is currently reporting healthy.
                            </p>
                        </DrawerSection>
                    )}
                </DetailsDrawer>
            ) : null}
        </>
    )
}

function SubsystemBadge({ issue }: { issue: WorkerDiagnosticIssue | null }) {
    if (!issue) {
        return (
            <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Healthy
            </span>
        )
    }
    const isError = issue.severity === 'error'
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

function StatusCard({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon?: typeof CheckCircle2
    label: string
    value: string | number
    tone: 'accent' | 'positive' | 'warning' | 'error' | 'muted'
}) {
    const tones: Record<string, string> = {
        accent: 'text-(--lagoon)',
        positive: 'text-emerald-500',
        warning: 'text-amber-600 dark:text-amber-400',
        error: 'text-red-500',
        muted: 'text-(--sea-ink-soft)',
    }
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-(--line) bg-(--surface-strong) px-3 py-2.5">
            {Icon ? (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(236,185,20,0.15)]">
                    <Icon className={`h-4 w-4 ${tones[tone]}`} aria-hidden="true" />
                </span>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                    {label}
                </p>
                <p className={`m-0 truncate text-lg font-bold leading-tight ${tones[tone]}`}>{value}</p>
            </div>
        </div>
    )
}

function statusLabel(status: WorkerDiagnostics['status']): string {
    if (status === 'ok') return 'Healthy'
    if (status === 'warning') return 'Attention'
    return 'Errors'
}

function statusTone(status: WorkerDiagnostics['status']): 'accent' | 'positive' | 'warning' | 'error' {
    if (status === 'ok') return 'positive'
    if (status === 'warning') return 'warning'
    return 'error'
}

function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}