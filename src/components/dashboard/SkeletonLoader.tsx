function SkeletonBox({ className }: { className?: string }) {
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
