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

const KEY_TITLES: Record<string, string> = {
    'system.startup': 'Startup',
    'db.connection': 'Database',
    'telegram.session': 'Telegram session',
    'telegram.listener': 'Telegram connection',
    'telegram.scan': 'Chat scan',
    'login.flow': 'Telegram login',
    'llm.analyze': 'Analysis',
    'analysis.config': 'Analysis config',
    'notifier.dispatch': 'Notifier',
}

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
    const errorCount = issues.filter((issue) => issue.severity === 'error').length
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length

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

                <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <StatusCard label="Status" value={statusLabel(status)} tone={statusTone(status)} />
                    <StatusCard
                        icon={CheckCircle2}
                        label="OK areas"
                        value={String(issues.length)}
                        tone="muted"
                        detail="(issues tracked)"
                    />
                    <StatusCard icon={AlertTriangle} label="Warnings" value={warningCount} tone="warning" />
                    <StatusCard icon={XCircle} label="Errors" value={errorCount} tone="error" />
                </div>

                <p className="mb-4 text-xs text-(--sea-ink-soft)">
                    {updatedAt ? `Last change reported at ${formatTime(updatedAt)}` : 'No changes reported yet'}
                    {' — auto-refreshes every 15s'}
                </p>

                {issues.length === 0 ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700/40 dark:bg-emerald-900/20">
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="m-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                All systems operational
                            </p>
                            <p className="m-0 text-xs text-emerald-600/90 dark:text-emerald-300/80">
                                No current failures across Telegram, analysis, dispatch, or the database.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {issues.map((issue) => (
                            <IssueCard key={issue.key} issue={issue} />
                        ))}
                    </div>
                )}

                <details className="mt-6">
                    <summary className="cursor-pointer select-none text-xs font-semibold text-(--sea-ink-soft) transition hover:text-(--sea-ink)">
                        Raw response
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-xl border border-(--line) bg-(--surface-strong) p-3 text-[11px] leading-relaxed text-(--sea-ink-soft)">
                        {JSON.stringify(state, null, 2)}
                    </pre>
                </details>
            </Panel>
        </>
    )
}

function IssueCard({ issue }: { issue: WorkerDiagnosticIssue }) {
    const isError = issue.severity === 'error'
    const wrapper = isError
        ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
    const Icon = isError ? XCircle : AlertTriangle
    const accent = isError ? 'text-red-500' : 'text-amber-600'

    return (
        <div className={`rounded-xl border px-4 py-3 ${wrapper}`}>
            <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${accent}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className={`m-0 text-sm font-semibold ${isError ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                        {issueTitle(issue)}
                    </p>
                    <p className={`m-0 text-xs ${isError ? 'text-red-600/90 dark:text-red-300/80' : 'text-amber-700/90 dark:text-amber-200/80'}`}>
                        {issue.message}
                        <span className="font-medium opacity-80">
                            {' · '}
                            {formatTime(issue.updatedAt)}
                        </span>
                    </p>
                    {issue.context ? (
                        <p className={`m-0 mt-1 text-xs ${isError ? 'text-red-600/90 dark:text-red-300/80' : 'text-amber-700/90 dark:text-amber-200/80'}`}>
                            <span className="font-semibold">{issue.context.chatTitle}</span>: “
                            {truncate(issue.context.messageText, 160)}”
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function StatusCard({
    icon: Icon,
    label,
    value,
    tone,
    detail,
}: {
    icon?: typeof CheckCircle2
    label: string
    value: string | number
    tone: 'accent' | 'positive' | 'warning' | 'error' | 'muted'
    detail?: string
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
            {detail ? <p className="m-0 text-[11px] text-(--sea-ink-soft)">{detail}</p> : null}
        </div>
    )
}

function issueTitle(issue: WorkerDiagnosticIssue): string {
    return KEY_TITLES[issue.key] ?? issue.key
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

function truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value
}