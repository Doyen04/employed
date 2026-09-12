import { Trash2, X } from 'lucide-react'

export function BulkSelectionBar({
    count,
    noun,
    confirmLabel = 'Delete selected',
    onClear,
    onDelete,
}: {
    count: number
    noun: string
    confirmLabel?: string
    onClear: () => void
    onDelete: () => void
}) {
    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) bg-(--surface-strong) px-3.5 py-2.5">
            <p className="m-0 text-xs font-semibold text-(--sea-ink) dark:text-zinc-200">
                {count} {noun} selected
            </p>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-(--sea-ink-soft) transition hover:text-(--sea-ink) dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {confirmLabel}
                </button>
            </div>
        </div>
    )
}