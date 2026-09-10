import type { LucideIcon } from 'lucide-react'

type StatCardTone = 'accent' | 'positive' | 'danger' | 'warning' | 'muted'

const ICON_BG: Record<StatCardTone, string> = {
    accent: 'bg-(--lagoon)/10 text-(--lagoon-deep)',
    positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    muted: 'bg-[rgba(79,61,53,0.08)] text-(--sea-ink-soft)',
}

export function StatCard({
    icon: Icon,
    label,
    value,
    tone,
    valueClassName,
}: {
    icon: LucideIcon
    label: string
    value: React.ReactNode
    tone: StatCardTone
    valueClassName?: string
}) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-(--line) bg-(--header-bg) px-3 py-2.5">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ICON_BG[tone]}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                    {label}
                </p>
                <p className={`m-0 truncate text-lg font-bold leading-tight ${valueClassName ?? 'text-(--sea-ink)'}`}>
                    {value}
                </p>
            </div>
        </div>
    )
}
