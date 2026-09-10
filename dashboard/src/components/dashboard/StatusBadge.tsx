import type { LucideIcon } from 'lucide-react'

const TONE_CLASSES: Record<string, string> = {
    sent: 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep)',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

export function StatusBadge({
    status,
    retryCount,
    icon: Icon,
}: {
    status: string
    retryCount?: number
    icon?: LucideIcon
}) {
    const tone = TONE_CLASSES[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
            {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
            {status.toUpperCase()}
            {retryCount != null && retryCount > 0 ? ` \u00b7 ${retryCount} retry${retryCount === 1 ? '' : 's'}` : ''}
        </span>
    )
}
