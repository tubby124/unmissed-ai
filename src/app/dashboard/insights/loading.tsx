export default function InsightsLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Header + range selector skeleton */}
      <div className="flex items-center justify-between">
        <div className="w-20 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
        <div className="flex gap-1.5">
          {['w-10', 'w-12', 'w-10'].map((w, i) => (
            <div key={i} className={`${w} h-7 rounded-lg animate-pulse`} style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
          ))}
        </div>
      </div>

      {/* Summary stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-16 h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
            <div className="w-12 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.1 }} />
            <div className="w-10 h-2 rounded animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.08 }} />
          </div>
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-28 h-3.5 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
            <div className="h-[180px] rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.06 }} />
          </div>
        ))}
      </div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-24 h-3.5 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.12 }} />
            <div className="h-[160px] rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.06 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
