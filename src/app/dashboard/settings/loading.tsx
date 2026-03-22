export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Tab bar skeleton */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {['w-16', 'w-12', 'w-14', 'w-14', 'w-16', 'w-20'].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 pb-3 pt-1">
              <div className="w-[13px] h-[13px] rounded-sm animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.2 }} />
              <div className={`${w} h-3.5 rounded animate-pulse`} style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.2 }} />
            </div>
          ))}
        </nav>
      </div>

      {/* Card skeletons — mimics the SettingsSection groups */}
      {[
        { headerW: 'w-40', lines: 3, height: 'h-[140px]' },
        { headerW: 'w-48', lines: 2, height: 'h-[110px]' },
        { headerW: 'w-36', lines: 3, height: 'h-[140px]' },
        { headerW: 'w-44', lines: 2, height: 'h-[110px]' },
      ].map((card, i) => (
        <div
          key={i}
          className="rounded-2xl border p-5 space-y-3"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-sm animate-pulse" style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
            <div className={`${card.headerW} h-4 rounded animate-pulse`} style={{ backgroundColor: 'var(--color-text-3)', opacity: 0.15 }} />
          </div>

          {/* Content lines */}
          <div className="space-y-2.5 pt-1">
            {Array.from({ length: card.lines }).map((_, j) => (
              <div
                key={j}
                className="h-3 rounded animate-pulse"
                style={{
                  backgroundColor: 'var(--color-text-3)',
                  opacity: 0.1,
                  width: j === 0 ? '90%' : j === card.lines - 1 ? '55%' : '75%',
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
