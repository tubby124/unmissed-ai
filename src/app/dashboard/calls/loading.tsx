export default function CallsLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* Agent test card skeleton */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
          <div className="space-y-2 flex-1">
            <div className="w-40 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
            <div className="w-60 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          </div>
        </div>
      </div>

      {/* Stats bar skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-12 h-3 rounded animate-pulse mb-2" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
            <div className="w-8 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          </div>
        ))}
      </div>

      {/* Call rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12, width: `${55 + (i % 3) * 15}%` }} />
              <div className="h-2.5 rounded animate-pulse w-1/3" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
            </div>
            <div className="w-14 h-5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
