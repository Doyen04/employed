import type { ReactNode } from 'react'

export interface LogTableColumn<T> {
    header: ReactNode
    cell: (row: T) => ReactNode
    className?: string
    align?: 'left' | 'right'
    hiddenOnMobile?: boolean
}

export function LogTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    rowAriaLabel,
}: {
    columns: LogTableColumn<T>[]
    rows: T[]
    rowKey: (row: T) => string
    onRowClick: (row: T) => void
    rowAriaLabel?: (row: T) => string
}) {
    const visible = columns.filter((column) => !column.hiddenOnMobile)
    const titleColumn = visible[0]
    const timeColumn = [...visible].reverse().find((column) => column.align === 'right')
    const metaColumns = visible.slice(1).filter((column) => column !== timeColumn)

    return (
        <div>
            <div className="hidden overflow-x-auto rounded-xl border border-(--line) md:block">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-(--sea-ink-soft)">
                            {columns.map((column, index) => (
                                <th
                                    key={index}
                                    className={`px-3 py-2.5 font-semibold ${column.align === 'right' ? 'text-right' : ''} ${column.hiddenOnMobile ? 'hidden md:table-cell' : ''
                                        }`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={rowKey(row)}
                                onClick={() => onRowClick(row)}
                                aria-label={rowAriaLabel?.(row)}
                                className="cursor-pointer border-t border-(--line)/70 transition hover:bg-white/50 dark:hover:bg-zinc-800/60"
                            >
                                {columns.map((column, index) => (
                                    <td
                                        key={index}
                                        className={`px-3 py-2.5 ${column.align === 'right' ? 'text-right' : ''} ${column.hiddenOnMobile ? 'hidden md:table-cell' : ''
                                            } ${column.className ?? ''}`}
                                    >
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="flex flex-col gap-2 md:hidden">
                {rows.map((row) => (
                    <li key={rowKey(row)}>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onRowClick(row)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') onRowClick(row)
                            }}
                            aria-label={rowAriaLabel?.(row)}
                            className="w-full cursor-pointer rounded-xl border border-(--line)/70 bg-(--header-bg) px-4 py-3 text-left transition hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-(--lagoon)/40 dark:hover:bg-zinc-800/60"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                                <div className="min-w-0">{titleColumn.cell(row)}</div>
                                {timeColumn ? <div className="shrink-0">{timeColumn.cell(row)}</div> : null}
                            </div>
                            {metaColumns.length > 0 ? (
                                <dl className="mt-2 divide-y divide-(--line)/60">
                                    {metaColumns.map((column, index) => (
                                        <div
                                            key={index}
                                            className="flex items-baseline justify-between gap-3 py-1.5"
                                        >
                                            <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
                                                {column.header}
                                            </dt>
                                            <dd className="min-w-0 truncate text-xs text-(--sea-ink)">
                                                {column.cell(row)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}