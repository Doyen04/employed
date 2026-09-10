import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { MobileCards } from './MobileCards'

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

export function LogTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    rowAriaLabel,
    grouping,
}: {
    columns: LogTableColumn<T>[]
    rows: T[]
    rowKey: (row: T) => string
    onRowClick?: (row: T) => void
    rowAriaLabel?: (row: T) => string
    grouping?: LogTableGrouping<T>
}) {
    const visible = columns.filter((column) => !column.hiddenOnMobile)
    const titleColumn = visible[0]
    const timeColumn = [...visible].reverse().find((column) => column.align === 'right')
    const metaColumns = visible.slice(1).filter((column) => column !== timeColumn)

    const segments: { key: string | undefined; rows: T[] }[] | null = grouping
        ? (() => {
              const out: { key: string | undefined; rows: T[] }[] = []
              let last: { key: string | undefined; rows: T[] } | undefined
              for (const row of rows) {
                  const key = grouping.groupBy(row)
                  if (last !== undefined && last.key === key) {
                      last.rows.push(row)
                  } else {
                      last = { key, rows: [row] }
                      out.push(last)
                  }
              }
              return out
          })()
        : null

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
    }

    const rowColumns = (row: T) =>
        columns.map((column, index) => (
            <td
                key={index}
                className={`px-3 py-2.5 ${column.align === 'right' ? 'text-right' : ''} ${column.hiddenOnMobile ? 'hidden md:table-cell' : ''
                    } ${column.className ?? ''}`}
            >
                {column.cell(row)}
            </td>
        ))

    return (
        <div>
            <div className="hidden overflow-x-auto rounded-xl border border-(--line) md:block">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-(--sea-ink-soft)">
                            {columns.map((column, index) => (
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
                                                  <td colSpan={columns.length} className="px-3 py-2">
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