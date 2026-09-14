import type { ReactNode } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

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
    onDelete,
    canDelete,
    selectable,
    selectedKeys,
    onToggleRow,
    deletingKey,
}: {
    rows: T[]
    rowKey: (row: T) => string
    title: (row: T) => ReactNode
    overlay?: (row: T) => ReactNode
    cells?: MobileCardCell<T>[]
    action?: (row: T) => ReactNode
    onRowClick?: (row: T) => void
    rowAriaLabel?: (row: T) => string
    onDelete?: (row: T) => void
    canDelete?: (row: T) => boolean
    selectable?: boolean
    selectedKeys?: ReadonlySet<string>
    onToggleRow?: (row: T) => void
    deletingKey?: string | null
}) {
    return (
        <ul className="flex flex-col gap-2.5">
            {rows.map((row) => {
                const deletable = !canDelete || canDelete(row)
                const rowKeyValue = rowKey(row)
                const deleting = deletingKey !== null && deletingKey !== undefined
                const rowDeleting = deletingKey !== null && rowKeyValue === deletingKey
                return (
                    <li key={rowKeyValue}>
                        <div
                            role={onRowClick ? 'button' : undefined}
                            tabIndex={onRowClick ? 0 : undefined}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            onKeyDown={onRowClick ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') onRowClick(row)
                            } : undefined}
                            aria-label={rowAriaLabel?.(row)}
                            className={`w-full rounded-xl border border-(--line) bg-(--surface-strong) p-3.5 text-left shadow-xs transition ${onRowClick
                                    ? 'cursor-pointer hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-(--lagoon)/40 dark:hover:bg-zinc-800/80'
                                    : ''}`}
                        >
                            {/* Top row: Title + Actions (NEVER wrap action to new line) */}
                            <div className="flex w-full min-w-0 items-center justify-between gap-2.5">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {selectable && deletable && selectedKeys && onToggleRow ? (
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys.has(rowKeyValue)}
                                            onChange={() => onToggleRow(row)}
                                            onClick={(event) => event.stopPropagation()}
                                            disabled={deleting}
                                            aria-label="Select row"
                                            className="h-4 w-4 shrink-0 cursor-pointer rounded accent-(--lagoon-deep) disabled:cursor-not-allowed"
                                        />
                                    ) : null}
                                    <div className="min-w-0 flex-1 overflow-hidden truncate font-medium text-(--sea-ink) dark:text-zinc-100">
                                        {title(row)}
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {overlay ? <div className="shrink-0">{overlay(row)}</div> : null}
                                    {onDelete && deletable ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete(row)
                                            }}
                                            disabled={deleting}
                                            aria-label={rowDeleting ? 'Deleting…' : 'Delete'}
                                            className="rounded-lg p-1.5 text-(--sea-ink-soft) transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                        >
                                            {rowDeleting ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {/* Metadata cells */}
                            {cells && cells.length > 0 ? (
                                <div className="mt-2.5 flex flex-col gap-2 border-t border-(--line)/40 pt-2.5">
                                    {cells.map((cell, index) => (
                                        <div key={index} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-(--sea-ink-soft)">
                                                {cell.label}
                                            </span>
                                            <div className="min-w-0 max-w-[70%] truncate text-right text-xs text-(--sea-ink) dark:text-zinc-200">
                                                {cell.value(row)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Additional custom action */}
                            {action ? <div className="mt-3 border-t border-(--line)/40 pt-2.5">{action(row)}</div> : null}
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}