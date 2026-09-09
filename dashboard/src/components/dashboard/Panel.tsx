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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-base font-semibold text-(--sea-ink)">{title}</h2>
          {description ? (
            <p className="m-0 mt-0.5 text-sm text-(--sea-ink-soft)">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}