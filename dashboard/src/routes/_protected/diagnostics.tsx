import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'

import { getDiagnostics } from '../../server/diagnostics'
import { Panel } from '../../components/dashboard/Panel'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import type { WorkerDiagnosticIssue, WorkerDiagnostics } from '../../lib/types'
import { errorText } from '../../lib/utils'

export const Route = createFileRoute('/_protected/diagnostics')({ component: DiagnosticsPage })

const POLL_MS = 15_000

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
        const timer = setInterval(() => void load(true), POLL_MS)
        return () => clearInterval(timer)
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
                            {' — auto-refreshes every 15s'}
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

                        <div className="overflow-hidden rounded-xl border border-(--line)">
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-(--line) text-left text-[11px] uppercase tracking-wider text-(--sea-ink-soft)">
                                            <th className="px-4 py-2.5 font-semibold">Subsystem</th>
                                            <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Key</th>
                                            <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Status</th>
                                            <th className="px-4 py-2.5 font-semibold">Message</th>
                                            <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.key} className="border-b border-(--line)/70 transition last:border-0">
                                                <td className="px-4 py-3 font-semibold text-(--sea-ink)">{row.title}</td>
                                                <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-(--sea-ink-soft) lg:table-cell">
                                                    {row.key}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3"><SubsystemBadge issue={row.issue} /></td>
                                                <td className="px-4 py-3 text-xs text-(--sea-ink-soft)">
                                                    {row.issue ? row.issue.message : '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-(--sea-ink-soft)">
                                                    {row.issue ? formatTime(row.issue.updatedAt) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="flex flex-col md:hidden">
                                {rows.map((row) => (
                                    <li key={row.key} className="border-b border-(--line)/70 px-4 py-3 last:border-0">
                                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                            <span className="min-w-0 truncate font-semibold text-(--sea-ink)">
                                                {row.title}
                                            </span>
                                            <SubsystemBadge issue={row.issue} />
                                        </div>
                                        <p className="m-0 mt-1 text-xs text-(--sea-ink-soft)">
                                            {row.issue ? row.issue.message : 'Operating normally'}
                                        </p>
                                        <p className="m-0 mt-0.5 font-mono text-[10px] text-(--sea-ink-soft)">{row.key}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>

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
        accent: 'border-(--lagoon) text-(--lagoon)',
        positive: 'border-emerald-400 text-emerald-500',
        warning: 'border-amber-400 text-amber-600',
        error: 'border-red-400 text-red-500',
        muted: 'border-(--line) text-(--sea-ink-soft)',
    }
    return (
        <div className="rounded-xl border border-(--line) bg-(--surface-strong) p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                {Icon ? <Icon className={`h-3.5 w-3.5 ${tones[tone]}`} aria-hidden="true" /> : null}
                {label}
            </div>
            <p className={`m-0 mt-1 text-xl font-bold ${tones[tone]}`}>{value}</p>
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