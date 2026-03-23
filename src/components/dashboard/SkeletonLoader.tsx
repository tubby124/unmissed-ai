export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg ${className ?? ''}`}
      style={{
        background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-hover) 50%, var(--color-surface) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-8 w-16" />
          <SkeletonBox className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function CallsListSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <SkeletonBox className="h-3 w-24" />
        <SkeletonBox className="h-6 w-32 rounded-full" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-4">
          <SkeletonBox className="h-2 w-2 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-3">
              <SkeletonBox className="h-3 w-32" />
              <SkeletonBox className="h-5 w-12 rounded-full" />
            </div>
            <SkeletonBox className="h-3 w-64" />
          </div>
          <SkeletonBox className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl p-4 card-surface space-y-2">
            <SkeletonBox className="h-7 w-10" />
            <SkeletonBox className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mini calendar */}
        <div className="lg:w-72 shrink-0">
          <div className="rounded-2xl p-4 card-surface space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBox className="h-4 w-28" />
              <div className="flex gap-1">
                <SkeletonBox className="h-6 w-6 rounded-md" />
                <SkeletonBox className="h-6 w-6 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array(35)].map((_, i) => (
                <SkeletonBox key={i} className="h-7 rounded-md" />
              ))}
            </div>
          </div>
        </div>
        {/* Booking list */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonBox key={i} className="h-7 w-20 rounded-lg" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl p-4 card-surface space-y-2">
              <div className="flex items-start gap-4">
                <SkeletonBox className="w-[68px] h-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBox className="h-4 w-32" />
                  <SkeletonBox className="h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CallDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
        <SkeletonBox className="h-3 w-24" />
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-3/4" />
      </div>
      {/* Player */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <SkeletonBox className="h-3 w-20" />
        <div className="flex items-center gap-4">
          <SkeletonBox className="w-10 h-10 rounded-full" />
          <SkeletonBox className="h-2 flex-1" />
        </div>
        <div className="flex gap-1 items-end h-10">
          {[...Array(60)].map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${25 + (i * 17 + 11) % 70}%`,
                background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-hover) 50%, var(--color-surface) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      </div>
      {/* Transcript */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <SkeletonBox className="h-3 w-24" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <SkeletonBox className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
