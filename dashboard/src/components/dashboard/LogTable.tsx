import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { MobileCards } from './MobileCards'
import { Trash2 } from 'lucide-react'

export interface LogTableColumn<T> {
    header: ReactNode
    cell: (row: T) => ReactNode
    className?: string
    align?: 'left' | 'right'
    hiddenOnMobile?: boolean
}

export interface LogTableGrouping<T> {
    groupBy: (row: T) => string | undefined
    groupHeader: (key: string) => ReactNode
    collapsedGroups?: ReadonlySet<string>
    onToggleGroup?: (key: string) => void
}

const DELETE_COLUMN_CLASS = 'logtable-delete'

export function LogTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    rowAriaLabel,
    grouping,
    onDelete,
    canDelete,
    selectable,
    selectedKeys,
    onSelectedKeysChange,
}: {
    columns: LogTableColumn<T>[]
    rows: T[]
    rowKey: (row: T) => string
    onRowClick?: (row: T) => void
    rowAriaLabel?: (row: T) => string
    grouping?: LogTableGrouping<T>
    onDelete?: (row: T, key: string) => void
    canDelete?: (row: T) => boolean
    selectable?: boolean
    selectedKeys?: ReadonlySet<string>
    onSelectedKeysChange?: (next: ReadonlySet<string>) => void
}) {
    const allColumns: LogTableColumn<T>[] = onDelete
        ? [
            ...columns,
            {
                header: <span className="sr-only">Delete</span>,
                cell: () => null,
                align: 'right',
                hiddenOnMobile: true,
                className: DELETE_COLUMN_CLASS,
            },
        ]
        : columns

    const visible = allColumns.filter((column) => !column.hiddenOnMobile)
    const titleColumn = visible[0]
    const timeColumn = [...visible].reverse().find((column) => column.align === 'right')
    const metaColumns = visible.slice(1).filter((column) => column !== timeColumn)

    const segments: { key: string | undefined; rows: T[] }[] | null = grouping
        ? (() => {
            const out: { key: string | undefined; rows: T[] }[] = []
            const byKey = new Map<string, { key: string; rows: T[] }>()
            let lastUngrouped: { key: undefined; rows: T[] } | undefined
            for (const row of rows) {
                const key = grouping.groupBy(row)
                if (key === undefined) {
                    if (lastUngrouped) {
                        lastUngrouped.rows.push(row)
                    } else {
                        lastUngrouped = { key: undefined, rows: [row] }
                        out.push(lastUngrouped)
                    }
                    continue
                }
                lastUngrouped = undefined
                let segment = byKey.get(key)
                if (!segment) {
                    segment = { key, rows: [] }
                    byKey.set(key, segment)
                    out.push(segment)
                }
                segment.rows.push(row)
            }
            return out
        })()
        : null

    const selectableEnabled = Boolean(selectable && selectedKeys && onSelectedKeysChange)
    const keys = selectedKeys ?? new Set<string>()

    const canRowSelect = (row: T) => !canDelete || canDelete(row)

    const visibleRows: T[] = segments
        ? segments.flatMap((segment) => {
            if (segment.key === undefined) return segment.rows
            return grouping?.collapsedGroups?.has(segment.key) ? [] : segment.rows
        })
        : rows

    const selectableRows = visibleRows.filter(canRowSelect)
    const selectedCount = selectableRows.filter((row) => keys.has(rowKey(row))).length
    const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length
    const someSelected = selectedCount > 0 && !allSelected
    const selectAllRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
    }, [someSelected])

    function toggleRow(row: T) {
        if (!onSelectedKeysChange) return
        const key = rowKey(row)
        const next = new Set(keys)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        onSelectedKeysChange(next)
    }

    function toggleAll() {
        if (!onSelectedKeysChange) return
        const next = new Set(keys)
        if (allSelected) {
            for (const row of selectableRows) next.delete(rowKey(row))
        } else {
            for (const row of selectableRows) next.add(rowKey(row))
        }
        onSelectedKeysChange(next)
    }

    const mobileCardsProps = {
        rowKey,
        title: (row: T) => titleColumn.cell(row),
        overlay: timeColumn ? (row: T) => timeColumn.cell(row) : undefined,
        cells: metaColumns.map((column) => ({
            label: column.header,
            value: (row: T) => column.cell(row),
        })),
        onRowClick,
        rowAriaLabel,
        onDelete: onDelete ? (row: T) => onDelete(row, rowKey(row)) : undefined,
        canDelete: canDelete ? (row: T) => canDelete(row) : undefined,
        selectable: selectableEnabled,
        selectedKeys: keys,
        onToggleRow: toggleRow,
    }

    const rowColumns = (row: T) => {
        const cells: ReactNode[] = []
        if (selectableEnabled) {
            cells.push(
                <td
                    key="__select"
                    className="w-10 px-3 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                >
                    {canRowSelect(row) ? (
                        <input
                            type="checkbox"
                            checked={keys.has(rowKey(row))}
                            onChange={() => toggleRow(row)}
                            aria-label="Select row"
                            className="h-4 w-4 cursor-pointer rounded accent-(--lagoon-deep)"
                        />
                    ) : null}
                </td>,
            )
        }
        allColumns.forEach((column, index) => {
            const deletable = canDelete ? canDelete(row) : true
            const isDelete =
                column.className === DELETE_COLUMN_CLASS && onDelete !== undefined && deletable
            cells.push(
                <td
                    key={index}
                    className={`px-3 py-2.5 ${column.align === 'right' ? 'text-right' : ''} ${column.hiddenOnMobile ? 'hidden md:table-cell' : ''
                        } ${column.className ?? ''}`}
                >
                    {isDelete ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(row, rowKey(row))
                            }}
                            aria-label="Delete"
                            className="p-1.5 rounded-lg text-(--sea-ink-soft) transition hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : (
                        column.cell(row)
                    )}
                </td>,
            )
        })
        return cells
    }

    return (
        <div>
            <div className="hidden overflow-x-auto rounded-xl border border-(--line) md:block">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-(--sea-ink-soft)">
                            {selectableEnabled ? (
                                <th className="w-10 px-3 py-2.5">
                                    <input
                                        ref={selectAllRef}
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        aria-label="Select all visible rows"
                                        className="h-4 w-4 cursor-pointer rounded accent-(--lagoon-deep)"
                                    />
                                </th>
                            ) : null}
                            {allColumns.map((column, index) => (
                                <th
                                    key={index}
                                    className={`whitespace-nowrap px-3 py-2.5 font-semibold ${column.align === 'right' ? 'text-right' : ''} ${column.hiddenOnMobile ? 'hidden md:table-cell' : ''
                                        }`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {segments
                            ? segments.map((segment) => {
                                const isGroup = segment.key !== undefined
                                const collapsed =
                                    isGroup && Boolean(grouping?.collapsedGroups?.has(segment.key as string))
                                return (
                                    <Fragment
                                        key={
                                            isGroup
                                                ? `group:${segment.key as string}`
                                                : `row:${rowKey(segment.rows[0])}`
                                        }
                                    >
                                        {isGroup ? (
                                            <tr
                                                onClick={() => grouping?.onToggleGroup?.(segment.key as string)}
                                                aria-label={collapsed ? 'Expand group' : 'Collapse group'}
                                                className="cursor-pointer border-t border-(--line) bg-(--header-bg) transition hover:bg-white/60 dark:hover:bg-zinc-800/60"
                                            >
                                                <td colSpan={allColumns.length + (selectableEnabled ? 1 : 0)} className="px-3 py-2">
                                                    {grouping!.groupHeader(segment.key as string)}
                                                </td>
                                            </tr>
                                        ) : null}
                                        {(!isGroup || !collapsed) &&
                                            segment.rows.map((row) => (
                                                <tr
                                                    key={rowKey(row)}
                                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                                    aria-label={rowAriaLabel?.(row)}
                                                    className={`border-t border-(--line)/70 ${onRowClick
                                                        ? 'cursor-pointer transition hover:bg-white/50 dark:hover:bg-zinc-800/60'
                                                        : ''
                                                        }`}
                                                >
                                                    {rowColumns(row)}
                                                </tr>
                                            ))}
                                    </Fragment>
                                )
                            })
                            : rows.map((row) => (
                                <tr
                                    key={rowKey(row)}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    aria-label={rowAriaLabel?.(row)}
                                    className={`border-t border-(--line)/70 ${onRowClick
                                        ? 'cursor-pointer transition hover:bg-white/50 dark:hover:bg-zinc-800/60'
                                        : ''
                                        }`}
                                >
                                    {rowColumns(row)}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {segments ? (
                <div className="flex flex-col gap-2 md:hidden">
                    {segments.map((segment) => {
                        if (segment.key === undefined) {
                            return (
                                <div key={`row:${rowKey(segment.rows[0])}`}>
                                    <MobileCards rows={segment.rows} {...mobileCardsProps} />
                                </div>
                            )
                        }
                        const key = segment.key
                        const collapsed = Boolean(grouping?.collapsedGroups?.has(key))
                        return (
                            <div key={`group:${key}`} className="overflow-hidden rounded-xl border border-(--line)">
                                <button
                                    type="button"
                                    onClick={() => grouping?.onToggleGroup?.(key)}
                                    aria-label={collapsed ? 'Expand group' : 'Collapse group'}
                                    className="flex w-full items-center gap-2.5 bg-(--header-bg) px-3 py-2.5 text-left"
                                >
                                    {grouping!.groupHeader(key)}
                                </button>
                                {!collapsed ? (
                                    <div className="border-t border-(--line)/70 p-2.5">
                                        <MobileCards rows={segment.rows} {...mobileCardsProps} />
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="md:hidden">
                    <MobileCards rows={rows} {...mobileCardsProps} />
                </div>
            )}
        </div>
    )
}