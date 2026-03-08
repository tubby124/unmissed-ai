'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AudioWaveformPlayer from './AudioWaveformPlayer'
import TranscriptTimeline from './TranscriptTimeline'
import StatusBadge from './StatusBadge'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
  transcript: Array<{ role: string; text: string; startTime?: number; endTime?: number }> | null
}

interface CallDetailProps {
  call: CallLog
  agentName?: string
}

function fmtDur(secs: number | null) {
  if (!secs) return null
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

const STATUS_GLOW: Record<string, string> = {
  HOT: 'border-red-500/30 shadow-red-500/10',
  WARM: 'border-amber-500/30 shadow-amber-500/10',
  COLD: 'border-blue-400/30',
  JUNK: 'border-zinc-500/30',
}

export default function CallDetail({ call, agentName = 'Agent' }: CallDetailProps) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const handleSeek = useCallback((time: number) => {
    // Pass seek back to player via DOM — audio ref is inside AudioWaveformPlayer
    // We use a custom event since the player manages its own audio ref
    const event = new CustomEvent('audio-seek', { detail: { time } })
    document.dispatchEvent(event)
  }, [])

  const dur = fmtDur(call.duration_seconds)
  const glowClass = STATUS_GLOW[call.call_status ?? ''] ?? 'border-white/[0.06]'
  const messages = (call.transcript ?? []).filter(m =>
    m.role === 'agent' || m.role === 'user'
  ) as Array<{ role: 'agent' | 'user'; text: string; startTime?: number; endTime?: number }>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04] flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Calls
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="font-mono text-zinc-200 text-sm">{call.caller_phone || 'Unknown'}</span>
          <StatusBadge status={call.call_status} />
          {dur && <span className="text-zinc-600 text-xs font-mono">{dur}</span>}
          <span className="text-zinc-600 text-xs">{timeAgo(call.started_at)}</span>
        </div>
      </div>

      {/* AI Summary */}
      {call.ai_summary && (
        <div className={`rounded-2xl border bg-white/[0.02] p-5 shadow-lg ${glowClass}`}>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">AI Summary</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{call.ai_summary}</p>
          {call.service_type && call.service_type !== 'other' && (
            <p className="text-xs text-zinc-600 mt-2 capitalize">
              Service: {call.service_type.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      )}

      {/* Audio player */}
      <AudioWaveformPlayer callId={call.ultravox_call_id} onTimeUpdate={setCurrentTime} />

      {/* Transcript */}
      <TranscriptTimeline
        messages={messages}
        currentTime={currentTime}
        onSeek={handleSeek}
        agentName={agentName}
      />

      {/* Metadata */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {call.end_reason && (
            <>
              <span className="text-zinc-600">End reason</span>
              <span className="text-zinc-400">{call.end_reason}</span>
            </>
          )}
          <span className="text-zinc-600">Ultravox ID</span>
          <span className="text-zinc-500 font-mono text-xs break-all">{call.ultravox_call_id}</span>
        </div>
      </div>
    </div>
  )
}
