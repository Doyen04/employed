import { AlertTriangle, XCircle } from 'lucide-react'

import type { WorkerDiagnosticIssue, WorkerDiagnostics } from '../../lib/types'

const ISSUE_TITLES: Record<string, string> = {
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

export function DiagnosticsBanner({ diagnostics }: { diagnostics: WorkerDiagnostics | null }) {
    if (!diagnostics || diagnostics.status === 'ok' || diagnostics.issues.length === 0) return null

    const issues = [...diagnostics.issues].sort((a, b) => rank(b.severity) - rank(a.severity))

    const hasErrors = issues.some((issue) => issue.severity === 'error')

    const wrapper = hasErrors
        ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
    const titleClass = hasErrors ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
    const bodyClass = hasErrors
        ? 'text-red-600/90 dark:text-red-300/80'
        : 'text-amber-700/90 dark:text-amber-200/80'

    const title =
        issues.length > 1
            ? `${issues.length} issue${issues.length > 1 ? 's' : ''} need${issues.length > 1 ? '' : 's'} attention`
            : issueTitle(issues[0])

    return (
        <div role="alert" className={`rounded-xl border px-4 py-3 ${wrapper}`}>
            <div className="flex items-start gap-2.5">
                <IssueIcon severity={issues[0].severity} className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${hasErrors ? 'text-red-500' : 'text-amber-600'}`} />
                <div className="min-w-0 flex-1">
                    <p className={`m-0 text-sm font-semibold ${titleClass}`}>{title}</p>
                    <div className="mt-1 space-y-2">
                        {issues.map((issue) => (
                            <div key={issue.key} className="m-0 text-xs">
                                <p className={`m-0 font-medium ${bodyClass}`}>
                                    {issueTitle(issue)}
                                    <span className="font-normal opacity-80">
                                        {' — '}
                                        {issue.message}
                                    </span>
                                    <span className="font-normal opacity-60">
                                        {' · '}
                                        {formatTime(issue.updatedAt)}
                                    </span>
                                </p>
                                {issue.context ? (
                                    <p className={`m-0 mt-0.5 ${bodyClass} opacity-90`}>
                                        {issue.context.chatTitle}: “
                                        {truncate(issue.context.messageText, 120)}”
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function issueTitle(issue: WorkerDiagnosticIssue): string {
    return ISSUE_TITLES[issue.key] ?? 'System'
}

function rank(severity: 'warning' | 'error'): number {
    return severity === 'error' ? 1 : 0
}

function IssueIcon({
    severity,
    className,
}: {
    severity: 'warning' | 'error'
    className: string
}) {
    return severity === 'error' ? <XCircle className={className} aria-hidden="true" /> : <AlertTriangle className={className} aria-hidden="true" />
}

function formatTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString()
}

function truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value
}