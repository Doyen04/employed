import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function DetailsDrawer({
  ariaLabel,
  icon,
  title,
  subtitle,
  onClose,
  children,
}: {
  ariaLabel: string
  icon: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-(--surface-strong) shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-(--line) px-5 py-4">
          <p className="m-0 flex min-w-0 items-center gap-2 text-sm font-bold text-(--sea-ink)">
            {icon}
            <span className="min-w-0 truncate">{title}</span>
            {subtitle}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-(--line) text-(--sea-ink-soft) transition hover:border-(--lagoon) hover:text-(--sea-ink)"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </aside>
    </div>
  )
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
        {title}
      </h3>
      {children}
    </section>
  )
}