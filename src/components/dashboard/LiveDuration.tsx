'use client'

import { useEffect, useState } from 'react'

// Max call duration is 600s (10min) + 1min buffer = 660s
const STALE_THRESHOLD_SECS = 660

export default function LiveDuration({ startedAt, className }: { startedAt: string; className?: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  )

  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  const isStale = secs > STALE_THRESHOLD_SECS

  if (isStale) {
    return (
      <span className={`tabular-nums text-yellow-400/80 ${className ?? ''}`}>
        {m}:{String(s).padStart(2, '0')} — stale?
      </span>
    )
  }
  return <span className={`tabular-nums ${className ?? ''}`}>{m}:{String(s).padStart(2, '0')}</span>
}
