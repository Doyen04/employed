import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  title: ReactNode
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
      : 'bg-(--lagoon-deep) text-white hover:opacity-90 dark:bg-(--lagoon) dark:text-[#4F3D35]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-(--line) bg-(--surface-strong) p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              tone === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-[rgba(236,185,20,0.18)] text-(--lagoon-deep) dark:text-(--lagoon)'
            }`}
          >
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-bold text-(--sea-ink) dark:text-zinc-100">{title}</h3>
            <div className="m-0 mt-1 text-xs leading-relaxed text-(--sea-ink-soft) dark:text-zinc-400">
              {message}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-(--line) px-4 py-2 text-xs font-semibold text-(--sea-ink) transition hover:border-(--lagoon) dark:text-zinc-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}