import type { ReactNode } from 'react'

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`island-shell rounded-2xl p-5 sm:p-6 ${className ?? ''}`.trim()}>
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-semibold text-(--sea-ink) dark:text-zinc-100">{title}</h2>
          {description ? (
            <p className="m-0 mt-0.5 text-sm text-(--sea-ink-soft) dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}