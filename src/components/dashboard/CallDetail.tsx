'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import AudioWaveformPlayer from './AudioWaveformPlayer'
import TranscriptTimeline from './TranscriptTimeline'
import StatusBadge from './StatusBadge'

// Pulsing aura circle — visual indicator for live audio state
function AudioAura({ lastRole }: { lastRole: 'agent' | 'user' | null }) {
  const isAgent = lastRole === 'agent'
  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto my-2">
      {/* Outer ring */}
      <motion.div
        className="absolute rounded-full"
        animate={{ scale: [1, 1.18, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ repeat: Infinity, duration: isAgent ? 1.8 : 2.6, ease: 'easeInOut' }}
        style={{
          width: '100%', height: '100%',
          background: isAgent
            ? 'radial-gradient(circle, rgba(34,197,94,0.5) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
        }}
      />
      {/* Middle ring */}
      <motion.div
        className="absolute rounded-full"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ repeat: Infinity, duration: isAgent ? 1.4 : 2.0, ease: 'easeInOut', delay: 0.2 }}
        style={{
          width: '65%', height: '65%',
          background: isAgent
            ? 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)',
        }}
      />
      {/* Core dot */}
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 36, height: 36,
          background: isAgent
            ? 'radial-gradient(circle, rgba(34,197,94,0.9) 0%, rgba(34,197,94,0.3) 100%)'
            : 'radial-gradient(circle, rgba(59,130,246,0.9) 0%, rgba(59,130,246,0.3) 100%)',
          boxShadow: isAgent
            ? '0 0 20px rgba(34,197,94,0.5)'
            : '0 0 20px rgba(59,130,246,0.5)',
        }}
      >
        <span className="text-[10px] font-bold text-white/90 tracking-wider">
          {isAgent ? 'AI' : 'YOU'}
        </span>
      </div>
    </div>
  )
}

interface TranscriptMessage {
  role: 'agent' | 'user'
  text: string
  startTime?: number
  endTime?: number
}

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
  transcript: TranscriptMessage[] | null
  confidence?: number | null
  sentiment?: string | null
  key_topics?: string[] | null
  next_steps?: string | null
  quality_score?: number | null
}

// Quality score semicircle gauge
function QualityGauge({ score }: { score: number }) {
  const R = 54, W = 140, H = 80
  const C = Math.PI * R // half circumference
  const clipped = Math.max(0, Math.min(100, score))
  const fill = (clipped / 100) * C
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Track */}
        <path
          d={`M ${(W - 2 * R) / 2} ${H} A ${R} ${R} 0 0 1 ${(W + 2 * R) / 2} ${H}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Zone tints */}
        <path d={`M ${(W - 2 * R) / 2} ${H} A ${R} ${R} 0 0 1 ${(W + 2 * R) / 2} ${H}`} fill="none" stroke="rgba(239,68,68,0.12)" strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${C * 0.4} ${C * 0.6}`} strokeDashoffset="0" />
        <path d={`M ${(W - 2 * R) / 2} ${H} A ${R} ${R} 0 0 1 ${(W + 2 * R) / 2} ${H}`} fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${C * 0.3} ${C * 0.7}`} strokeDashoffset={-(C * 0.4)} />
        <path d={`M ${(W - 2 * R) / 2} ${H} A ${R} ${R} 0 0 1 ${(W + 2 * R) / 2} ${H}`} fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${C * 0.3} ${C * 0.7}`} strokeDashoffset={-(C * 0.7)} />
        {/* Fill */}
        <path
          d={`M ${(W - 2 * R) / 2} ${H} A ${R} ${R} 0 0 1 ${(W + 2 * R) / 2} ${H}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${C - fill}`}
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease', filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
        {/* Score text */}
        <text x={W / 2} y={H - 6} textAnchor="middle" fill={color} fontSize="22" fontFamily="monospace" fontWeight="700" opacity={0.95}>
          {score}
        </text>
        <text x={W / 2} y={H + 6} textAnchor="middle" fill="rgba(161,161,170,0.5)" fontSize="9" fontFamily="monospace">
          QUALITY
        </text>
      </svg>
    </div>
  )
}

const SENTIMENT_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  positive:    { label: 'Positive',    color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25' },
  neutral:     { label: 'Neutral',     color: 'text-zinc-400',   bg: 'bg-white/[0.04] border-white/[0.1]' },
  negative:    { label: 'Negative',    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25' },
  frustrated:  { label: 'Frustrated',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
  indifferent: { label: 'Indifferent', color: 'text-zinc-500',   bg: 'bg-white/[0.03] border-white/[0.07]' },
}

interface CallDetailProps {
  call: CallLog
  agentName?: string
  isLive?: boolean
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

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  )
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return <span className="tabular-nums">{m}:{String(s).padStart(2, '0')}</span>
}

const STATUS_GLOW: Record<string, string> = {
  HOT: 'border-red-500/30 shadow-red-500/10',
  WARM: 'border-amber-500/30 shadow-amber-500/10',
  COLD: 'border-blue-400/30',
  JUNK: 'border-zinc-500/30',
}

const BARS = [0.4, 0.9, 0.6, 1, 0.7, 0.85, 0.45, 0.75]

export default function CallDetail({ call, agentName = 'Agent', isLive = false }: CallDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [liveMessages, setLiveMessages] = useState<TranscriptMessage[]>([])
  const [callStatus, setCallStatus] = useState(call.call_status)
  const [finalCall, setFinalCall] = useState<CallLog | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [whisper, setWhisper] = useState('')
  const [whisperSending, setWhisperSending] = useState(false)
  const [whisperSent, setWhisperSent] = useState(false)
  const [ending, setEnding] = useState(false)

  const transcriptPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleSeek = useCallback((time: number) => {
    document.dispatchEvent(new CustomEvent('audio-seek', { detail: { time } }))
  }, [])

  const handleWhisper = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!whisper.trim() || whisperSending) return
    setWhisperSending(true)
    try {
      await fetch(`/api/dashboard/calls/${call.ultravox_call_id}/whisper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: whisper.trim() }),
      })
      setWhisper('')
      setWhisperSent(true)
      setTimeout(() => setWhisperSent(false), 2500)
    } finally {
      setWhisperSending(false)
    }
  }

  const handleEndCall = async () => {
    if (ending) return
    setEnding(true)
    await fetch(`/api/dashboard/calls/${call.ultravox_call_id}/whisper`, {
      method: 'DELETE',
    })
    // Status polling will pick up the transition automatically
  }

  // TRANSCRIPT POLLING — reactive to callStatus; starts when 'live', stops otherwise
  useEffect(() => {
    if (callStatus !== 'live') {
      if (transcriptPollRef.current) {
        clearInterval(transcriptPollRef.current)
        transcriptPollRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/dashboard/calls/${call.ultravox_call_id}/messages`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const { messages } = await res.json()
        if (Array.isArray(messages)) setLiveMessages(messages)
      } catch { /* network hiccup — keep polling */ }
    }

    poll()
    transcriptPollRef.current = setInterval(poll, 2500)
    return () => {
      if (transcriptPollRef.current) {
        clearInterval(transcriptPollRef.current)
        transcriptPollRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, call.ultravox_call_id])

  // STATUS POLLING — always start unless already classified
  useEffect(() => {
    const alreadyDone = ['HOT', 'WARM', 'COLD', 'JUNK'].includes(call.call_status ?? '')
    if (alreadyDone) return

    const poll = async () => {
      const { data } = await supabase
        .from('call_logs')
        .select('call_status, ai_summary, service_type, duration_seconds, ended_at, end_reason, transcript, confidence, sentiment, key_topics, next_steps, quality_score')
        .eq('ultravox_call_id', call.ultravox_call_id)
        .single()

      if (!data) return
      setCallStatus(data.call_status)

      if (['HOT', 'WARM', 'COLD', 'JUNK'].includes(data.call_status ?? '')) {
        if (statusPollRef.current) {
          clearInterval(statusPollRef.current)
          statusPollRef.current = null
        }
        if (transcriptPollRef.current) {
          clearInterval(transcriptPollRef.current)
          transcriptPollRef.current = null
        }
        setFinalCall({ ...call, ...data })
      }
    }

    poll() // immediate first check
    statusPollRef.current = setInterval(poll, 5000)
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.ultravox_call_id])

  const displayCall = finalCall ?? call
  const isActuallyLive = callStatus === 'live'
  const isProcessing = callStatus === 'processing'
  const isClassified = ['HOT', 'WARM', 'COLD', 'JUNK'].includes(callStatus ?? '')
  const hasRealSummary = !!(displayCall.ai_summary && displayCall.ai_summary !== 'Call transcript unavailable or too short to classify.')

  const dur = fmtDur(displayCall.duration_seconds)
  const glowClass = STATUS_GLOW[displayCall.call_status ?? ''] ?? 'border-white/[0.06]'

  const staticMessages = ((finalCall?.transcript ?? call.transcript) ?? []).filter(m =>
    m.role === 'agent' || m.role === 'user'
  ) as TranscriptMessage[]

  const messages = isActuallyLive ? liveMessages : staticMessages
  const lastRole = messages.length > 0 ? (messages[messages.length - 1].role as 'agent' | 'user') : null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04] flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0 flex-wrap">
          <span className="font-mono text-zinc-200 text-sm shrink-0">{displayCall.caller_phone || 'Unknown'}</span>
          {isActuallyLive ? (
            <>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-[11px] font-bold tracking-widest uppercase text-green-400">Live</span>
              </span>
              <span className="text-green-300 font-mono text-sm font-semibold shrink-0">
                <LiveDuration startedAt={call.started_at} />
              </span>
            </>
          ) : (
            <>
              <StatusBadge status={displayCall.call_status} />
              {dur && <span className="text-zinc-600 text-xs font-mono shrink-0">{dur}</span>}
              <span className="text-zinc-600 text-xs shrink-0">{timeAgo(displayCall.started_at)}</span>
            </>
          )}
        </div>
        {isActuallyLive && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-px h-5">
              {BARS.map((peak, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full bg-green-400/60"
                  animate={{ scaleY: [0.15, peak, 0.15] }}
                  transition={{ repeat: Infinity, duration: 0.6 + (i % 3) * 0.12, delay: i * 0.07, ease: 'easeInOut' }}
                  style={{ height: '100%', transformOrigin: 'center', display: 'inline-block' }}
                />
              ))}
            </div>
            <button
              onClick={handleEndCall}
              disabled={ending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-40"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {ending ? 'Ending…' : 'End Call'}
            </button>
          </div>
        )}
      </div>

      {/* Live: audio aura + speaker state */}
      {isActuallyLive && (
        <div
          className="rounded-2xl border border-green-500/20 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #030e06, #040e0700)',
            boxShadow: '0 0 40px rgba(34,197,94,0.05), inset 0 1px 0 rgba(34,197,94,0.1)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,197,94,0.05) 0%, transparent 70%)' }}
          />
          <div className="relative flex flex-col items-center py-4">
            <AudioAura lastRole={lastRole} />
            <p className="text-[11px] text-zinc-600 mt-1">
              {lastRole === 'agent' ? 'Agent speaking' : lastRole === 'user' ? 'Caller speaking' : 'Waiting…'}
            </p>
            <p className="text-[10px] text-zinc-700 mt-0.5">Transcript updates every 2.5s</p>
          </div>
        </div>
      )}

      {/* Processing banner */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4 flex items-center gap-3"
          >
            <svg className="w-4 h-4 animate-spin text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-xs text-amber-400/80 font-medium">Call ended — classifying lead with AI…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Summary */}
      <AnimatePresence>
        {isClassified && !hasRealSummary && (
          <div key="no-analysis" className="rounded-2xl border border-white/[0.04] bg-white/[0.01] px-5 py-3">
            <p className="text-[11px] text-zinc-700 italic">No AI analysis for this call.</p>
          </div>
        )}
        {hasRealSummary && (isClassified || !isLive) && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-2xl border bg-white/[0.02] p-5 shadow-lg ${glowClass}`}
          >
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-2">AI Summary</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{displayCall.ai_summary}</p>
            {displayCall.service_type && displayCall.service_type !== 'other' && (
              <p className="text-xs text-zinc-600 mt-2 capitalize">
                Service: {displayCall.service_type.replace(/_/g, ' ')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intelligence panels — quality, confidence, sentiment, topics, next steps */}
      <AnimatePresence>
        {isClassified && (displayCall.quality_score != null || displayCall.confidence != null || displayCall.key_topics?.length || displayCall.next_steps) && (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-3"
          >
            {/* Quality gauge + Confidence + Sentiment */}
            {(displayCall.quality_score != null || displayCall.confidence != null || displayCall.sentiment) && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {displayCall.quality_score != null && (
                  <QualityGauge score={displayCall.quality_score} />
                )}
                <div className="flex-1 min-w-0 space-y-3">
                  {displayCall.confidence != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Confidence</span>
                        <span className="text-[11px] font-mono text-zinc-400">{displayCall.confidence}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${displayCall.confidence}%`,
                            background: displayCall.confidence >= 75 ? '#ef4444' : displayCall.confidence >= 50 ? '#f59e0b' : '#60a5fa',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {displayCall.sentiment && SENTIMENT_DISPLAY[displayCall.sentiment] && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Sentiment</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${SENTIMENT_DISPLAY[displayCall.sentiment].bg} ${SENTIMENT_DISPLAY[displayCall.sentiment].color}`}>
                        {SENTIMENT_DISPLAY[displayCall.sentiment].label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Key topics */}
            {displayCall.key_topics && displayCall.key_topics.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Key Topics</p>
                <div className="flex flex-wrap gap-2">
                  {displayCall.key_topics.map(topic => (
                    <span
                      key={topic}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.08]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Next steps */}
            {displayCall.next_steps && (
              <div className="flex items-start gap-3 pl-4 py-3 pr-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 mt-0.5 shrink-0">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-400/70 mb-0.5">Recommended Action</p>
                  <p className="text-sm text-amber-300/90 font-medium leading-relaxed">{displayCall.next_steps}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio player — only post-call */}
      {!isActuallyLive && !isProcessing && (
        <AudioWaveformPlayer callId={displayCall.ultravox_call_id} onTimeUpdate={setCurrentTime} />
      )}

      {/* Transcript */}
      <TranscriptTimeline
        messages={messages}
        currentTime={currentTime}
        onSeek={handleSeek}
        agentName={agentName}
        isLive={isActuallyLive}
      />

      {/* Supervisor whisper bar — only during live call */}
      {isActuallyLive && (
        <form onSubmit={handleWhisper} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={whisper}
              onChange={e => setWhisper(e.target.value)}
              placeholder="Whisper to agent (caller won't hear)…"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-amber-500/30 transition-colors pr-24"
            />
            {whisperSent && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-amber-400 font-medium">
                Sent ✓
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={whisperSending || !whisper.trim()}
            className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/35 transition-all disabled:opacity-30"
          >
            {whisperSending ? '…' : 'Whisper'}
          </button>
        </form>
      )}

      {/* Metadata — post-call only */}
      {!isActuallyLive && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-3">Details</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {displayCall.end_reason && (
              <>
                <span className="text-zinc-600">End reason</span>
                <span className="text-zinc-400">{displayCall.end_reason}</span>
              </>
            )}
            <span className="text-zinc-600">Ultravox ID</span>
            <span className="text-zinc-500 font-mono text-xs break-all">{displayCall.ultravox_call_id}</span>
          </div>
        </div>
      )}
    </div>
  )
}
