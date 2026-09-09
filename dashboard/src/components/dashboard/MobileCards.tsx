import type { ReactNode } from 'react'

export interface MobileCardCell<T> {
    label: ReactNode
    value: (row: T) => ReactNode
}

export function MobileCards<T>({
    rows,
    rowKey,
    title,
    overlay,
    cells,
    action,
    onRowClick,
    rowAriaLabel,
}: {
    rows: T[]
    rowKey: (row: T) => string
    title: (row: T) => ReactNode
    overlay?: (row: T) => ReactNode
    cells?: MobileCardCell<T>[]
    action?: (row: T) => ReactNode
    onRowClick?: (row: T) => void
    rowAriaLabel?: (row: T) => string
}) {
    return (
        <ul className="flex flex-col gap-2">
            {rows.map((row) => (
                <li key={rowKey(row)}>
                    <div
                        role={onRowClick ? 'button' : undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        onKeyDown={onRowClick ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') onRowClick(row)
                        } : undefined}
                        aria-label={rowAriaLabel?.(row)}
                        className={`w-full rounded-xl border border-(--line)/70 bg-(--header-bg) px-4 py-3 text-left ${onRowClick
                                ? 'cursor-pointer transition hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-(--lagoon)/40 dark:hover:bg-zinc-800/60'
                                : ''
                            }`}
                    >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                            <div className="min-w-0 max-w-full">{title(row)}</div>
                            {overlay ? <div className="shrink-0">{overlay(row)}</div> : null}
                        </div>
                        {cells && cells.length > 0 ? (
                            <dl className="mt-2 divide-y divide-(--line)/60">
                                {cells.map((cell, index) => (
                                    <div key={index} className="flex items-baseline justify-between gap-3 py-1.5">
                                        <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                            {cell.label}
                                        </dt>
                                        <dd className="min-w-0 max-w-full truncate text-xs text-(--sea-ink)">
                                            {cell.value(row)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}
                        {action ? <div className="mt-3">{action(row)}</div> : null}
                    </div>
                </li>
            ))}
        </ul>
    )
}