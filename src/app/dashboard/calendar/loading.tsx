export default function CalendarLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* Header + filters skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-24 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-20 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          ))}
        </div>
      </div>

      {/* Timeline entries skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 flex gap-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-12 text-center space-y-1 flex-shrink-0">
              <div className="w-8 h-3 rounded animate-pulse mx-auto" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
              <div className="w-6 h-5 rounded animate-pulse mx-auto" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded animate-pulse w-2/3" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
              <div className="h-2.5 rounded animate-pulse w-1/2" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
            </div>
            <div className="w-16 h-6 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
