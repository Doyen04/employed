import type { ReactNode } from 'react'
import { MobileCards } from './MobileCards'

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
    onRowClick?: (row: T) => void
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
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                aria-label={rowAriaLabel?.(row)}
                                className={`border-t border-(--line)/70 ${onRowClick
                                        ? 'cursor-pointer transition hover:bg-white/50 dark:hover:bg-zinc-800/60'
                                        : ''
                                    }`}
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

            <div className="md:hidden">
                <MobileCards
                    rows={rows}
                    rowKey={rowKey}
                    title={(row: T) => titleColumn.cell(row)}
                    overlay={timeColumn ? (row: T) => timeColumn.cell(row) : undefined}
                    cells={metaColumns.map((column) => ({
                        label: column.header,
                        value: (row: T) => column.cell(row),
                    }))}
                    onRowClick={onRowClick}
                    rowAriaLabel={rowAriaLabel}
                />
            </div>
        </div>
    )
}