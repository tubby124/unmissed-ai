export default function NotificationsLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* Header skeleton */}
      <div className="w-32 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />

      {/* Stats row skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-14 h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
            <div className="w-8 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          </div>
        ))}
      </div>

      {/* Notification cards skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-8 h-8 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12, width: `${60 + (i % 3) * 12}%` }} />
              <div className="h-2.5 rounded animate-pulse w-2/5" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
            </div>
            <div className="w-12 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
