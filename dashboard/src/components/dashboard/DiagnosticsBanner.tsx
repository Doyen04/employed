import { AlertTriangle, XCircle } from 'lucide-react'

import type { WorkerDiagnostics } from '../../lib/types'

export function DiagnosticsBanner({ diagnostics }: { diagnostics: WorkerDiagnostics | null }) {
    if (!diagnostics || diagnostics.status === 'ok') return null

    const isError = diagnostics.status === 'error'

    const wrapper = isError
        ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
    const iconClass = isError ? 'text-red-500' : 'text-amber-600'
    const titleClass = isError ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
    const bodyClass = isError
        ? 'text-red-600/90 dark:text-red-300/80'
        : 'text-amber-700/90 dark:text-amber-200/80'

    const Icon = isError ? XCircle : AlertTriangle

    return (
        <div role="alert" className={`rounded-xl border px-4 py-3 ${wrapper}`}>
            <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${iconClass}`} aria-hidden="true" />
                <div className="min-w-0">
                    <p className={`m-0 text-sm font-semibold ${titleClass}`}>
                        {isError ? 'Analysis failed' : 'Analysis not running'}
                    </p>
                    <p className={`m-0 text-xs ${bodyClass}`}>
                        {diagnostics.message ?? 'Unknown issue'}
                        {diagnostics.updatedAt ? ` · ${formatTime(diagnostics.updatedAt)}` : ''}
                    </p>
                    {diagnostics.context ? (
                        <p className={`m-0 mt-1 text-xs ${bodyClass}`}>
                            {diagnostics.context.chatTitle}: “{truncate(diagnostics.context.messageText, 120)}”
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
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