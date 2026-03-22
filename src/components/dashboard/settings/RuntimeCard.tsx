'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface RuntimeData {
  promptLength: number
  toolCount: number
  tools: string[]
  maxDuration: string
  vadSettings: Record<string, unknown> | null
  inactivityMessages: Array<Record<string, unknown>>
  firstSpeakerSettings: Record<string, unknown> | null
  voice: string | null
  totalCalls: number
  recordingEnabled: boolean
  stale?: boolean
}

interface RuntimeCardProps {
  client: ClientConfig
}

export default function RuntimeCard({ client }: RuntimeCardProps) {
  const [data, setData] = useState<RuntimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Feature flag
  const showCard = process.env.NEXT_PUBLIC_SHOW_RUNTIME_CARD !== 'false'

  useEffect(() => {
    if (!showCard) return

    setLoading(true)
    setError(false)

    fetch(`/api/dashboard/runtime?client_id=${client.id}`)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((d: RuntimeData) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [client.id, showCard])

  if (!showCard) return null

  if (loading) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Agent Runtime</p>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 rounded bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Agent Runtime</p>
        <p className="text-[11px] text-red-400/70">Failed to load runtime config</p>
      </div>
    )
  }

  const promptColor =
    data.promptLength > 12000 ? 'text-red-400' :
    data.promptLength > 8000 ? 'text-amber-400' :
    'text-green-400'

  const promptBg =
    data.promptLength > 12000 ? 'bg-red-500/10 border-red-500/20' :
    data.promptLength > 8000 ? 'bg-amber-500/10 border-amber-500/20' :
    'bg-green-500/10 border-green-500/20'

  // Format max duration from "600s" to "10 min"
  const durationStr = (() => {
    const match = data.maxDuration.match(/^(\d+)s$/)
    if (match) {
      const secs = parseInt(match[1], 10)
      return secs >= 60 ? `${Math.floor(secs / 60)} min` : `${secs}s`
    }
    return data.maxDuration
  })()

  // Format VAD settings
  const vadLabel = (() => {
    if (!data.vadSettings || Object.keys(data.vadSettings).length === 0) return 'Default'
    const parts: string[] = []
    if (data.vadSettings.turnEndpointDelay != null) parts.push(`endpoint: ${data.vadSettings.turnEndpointDelay}`)
    if (data.vadSettings.frameActivationThreshold != null) parts.push(`threshold: ${data.vadSettings.frameActivationThreshold}`)
    return parts.length > 0 ? parts.join(', ') : 'Custom'
  })()

  // Format inactivity messages
  const inactivityLabel = (() => {
    if (!data.inactivityMessages || data.inactivityMessages.length === 0) return 'None'
    return `${data.inactivityMessages.length} message${data.inactivityMessages.length > 1 ? 's' : ''}`
  })()

  // Format first speaker
  const firstSpeakerLabel = (() => {
    if (!data.firstSpeakerSettings) return 'Default'
    const fs = data.firstSpeakerSettings
    if (fs.agent) return 'Agent speaks first'
    if (fs.user) return 'User speaks first'
    return 'Custom'
  })()

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Agent Runtime</p>
        {data.stale && (
          <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5 leading-none">
            stale
          </span>
        )}
      </div>
      <p className="text-[11px] t3 mb-4">Live Ultravox agent configuration as deployed.</p>

      <div className="grid grid-cols-2 gap-2">
        {/* Prompt size */}
        <div className={`px-3 py-2.5 rounded-xl border ${promptBg}`}>
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Prompt</p>
          <p className={`text-sm font-mono font-semibold tabular-nums ${promptColor}`}>
            {data.promptLength.toLocaleString()} <span className="text-[10px] font-normal t3">/ 12,000</span>
          </p>
        </div>

        {/* Tool count */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Tools</p>
          <p className="text-sm font-mono font-semibold t1 tabular-nums">{data.toolCount}</p>
        </div>

        {/* Max duration */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Max Duration</p>
          <p className="text-sm font-mono font-semibold t1">{durationStr}</p>
        </div>

        {/* Total calls */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Total Calls</p>
          <p className="text-sm font-mono font-semibold t1 tabular-nums">{data.totalCalls.toLocaleString()}</p>
        </div>

        {/* VAD settings */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">VAD</p>
          <p className="text-xs t2">{vadLabel}</p>
        </div>

        {/* Inactivity */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Inactivity</p>
          <p className="text-xs t2">{inactivityLabel}</p>
        </div>

        {/* First speaker */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">First Speaker</p>
          <p className="text-xs t2">{firstSpeakerLabel}</p>
        </div>

        {/* Recording */}
        <div className="px-3 py-2.5 rounded-xl border b-theme bg-white/[0.02]">
          <p className="text-[10px] t3 uppercase tracking-wider mb-0.5">Recording</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data.recordingEnabled ? 'bg-green-400' : 'bg-zinc-600'}`} />
            <p className="text-xs t2">{data.recordingEnabled ? 'On' : 'Off'}</p>
          </div>
        </div>
      </div>

      {/* Tool names list */}
      {data.tools.length > 0 && (
        <div className="mt-3 pt-3 border-t b-theme">
          <p className="text-[10px] t3 uppercase tracking-wider mb-2">Registered Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {data.tools.map((tool, i) => (
              <span
                key={`${tool}-${i}`}
                className="text-[10px] font-mono t2 bg-white/[0.04] border b-theme rounded-md px-2 py-1"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
