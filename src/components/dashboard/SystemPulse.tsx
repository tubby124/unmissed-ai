'use client'

import { useEffect, useState } from 'react'

interface PulseData {
  ok: boolean
  ts: number
  supabase: string
  agents: Record<string, string>
}

export default function SystemPulse() {
  const [pulse, setPulse] = useState<PulseData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true

    async function fetchPulse() {
      try {
        const res = await fetch('/api/dashboard/system-pulse')
        if (!mounted) return
        const data = await res.json()
        setPulse(data)
        setError(false)
      } catch {
        if (mounted) setError(true)
      }
    }

    fetchPulse()
    const id = setInterval(fetchPulse, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // Loading state
  if (!pulse && !error) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
        <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Checking systems...</span>
      </div>
    )
  }

  // Network error
  if (error && !pulse) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-400">System check failed</span>
      </div>
    )
  }

  if (!pulse) return null

  // All clear
  if (pulse.ok) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/20 bg-green-500/5">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-green-400 font-medium">All systems operational</span>
        <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-3)' }}>
          {new Date(pulse.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    )
  }

  // Degraded — show what's wrong
  const issues: string[] = []
  if (pulse.supabase !== 'ok') issues.push('Database')
  for (const [slug, status] of Object.entries(pulse.agents)) {
    if (status !== 'ok') issues.push(`Agent: ${slug}`)
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs text-amber-400 font-medium">
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'} detected
        </span>
        <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-3)' }}>
          {new Date(pulse.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="px-4 pb-3 space-y-1">
        {pulse.supabase !== 'ok' && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="text-red-400">Database: {pulse.supabase}</span>
          </div>
        )}
        {Object.entries(pulse.agents).filter(([, s]) => s !== 'ok').map(([slug, status]) => (
          <div key={slug} className="flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-amber-400">{slug}: {status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
