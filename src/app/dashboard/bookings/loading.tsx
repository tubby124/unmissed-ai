export default function BookingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border b-theme bg-surface p-4">
            <div className="h-3 w-16 rounded" style={{ background: 'var(--color-border)' }} />
            <div className="h-7 w-10 rounded mt-2" style={{ background: 'var(--color-border)' }} />
          </div>
        ))}
      </div>

      {/* Upcoming label */}
      <div className="h-3 w-24 rounded" style={{ background: 'var(--color-border)' }} />

      {/* Upcoming cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border b-theme bg-surface p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-7 w-24 rounded" style={{ background: 'var(--color-border)' }} />
                <div className="h-3 w-32 rounded" style={{ background: 'var(--color-border)' }} />
              </div>
              <div className="h-5 w-16 rounded-full" style={{ background: 'var(--color-border)' }} />
            </div>
            <div className="h-px" style={{ background: 'var(--color-border)' }} />
            <div className="space-y-2">
              <div className="h-3 w-28 rounded" style={{ background: 'var(--color-border)' }} />
              <div className="h-3 w-20 rounded" style={{ background: 'var(--color-border)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Past label */}
      <div className="h-3 w-20 rounded" style={{ background: 'var(--color-border)' }} />

      {/* Past table rows */}
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b b-theme last:border-0">
            <div className="h-3 w-24 rounded" style={{ background: 'var(--color-border)' }} />
            <div className="h-3 w-16 rounded" style={{ background: 'var(--color-border)' }} />
            <div className="h-3 w-20 rounded ml-auto" style={{ background: 'var(--color-border)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
