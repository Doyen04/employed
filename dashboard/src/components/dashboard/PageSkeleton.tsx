export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="overview-skeleton" role="status" aria-label={label}>
      <div className="skeleton-line wide" />
      <div className="skeleton-line" />
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} />
        ))}
      </div>
      <div className="skeleton-panel" />
    </div>
  )
}