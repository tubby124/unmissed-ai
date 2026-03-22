export default function DashboardLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-1">
        <div className="w-36 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
        <div className="w-56 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
      </div>

      {/* System pulse skeleton */}
      <div className="rounded-2xl border p-5 h-[100px]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 space-y-2">
              <div className="w-16 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
              <div className="w-10 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Action items skeleton */}
      <div className="space-y-2">
        <div className="w-24 h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-3/4 h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
