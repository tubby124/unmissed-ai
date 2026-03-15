'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import StatusBadge from './StatusBadge'
import AudioWaveformPlayer from './AudioWaveformPlayer'

interface TranscriptMsg { role: string; text: string }

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  business_name?: string | null
  confidence?: number | null
  sentiment?: string | null
  key_topics?: string[] | null
  next_steps?: string | null
  quality_score?: number | null
}

const STATUS_STRIPE: Record<string, string> = {
  HOT:        '#ef4444',
  WARM:       '#f59e0b',
  COLD:       '#60a5fa',
  JUNK:       '#3f3f46',
  live:       '#22c55e',
  processing: '#eab308',
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
  if (days > 0) return `${days}d`
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return 'now'
}

interface ExpandedData {
  transcript: TranscriptMsg[] | null
  key_topics: string[] | null
  next_steps: string | null
  confidence: number | null
  sentiment: string | null
}

const RECORDING_STATUSES = new Set(['HOT', 'WARM', 'COLD'])

// iMessage-style: blue = good call, green = bad/missed call
const IMESSAGE_BLUE = '#007AFF'
const IMESSAGE_GREEN = '#34C759'
const GOOD_STATUSES = new Set(['HOT', 'WARM', 'live', 'processing'])

export default function CallRow({ call, showBusiness, onCallBack }: {
  call: CallLog
  showBusiness?: boolean
  onCallBack?: (phone: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandData, setExpandData] = useState<ExpandedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [recordingAvailable, setRecordingAvailable] = useState<boolean | null>(null)
  const [recordingLoading, setRecordingLoading] = useState(false)
  const supabase = createBrowserClient()

  const dur = fmtDur(call.duration_seconds)
  const stripeColor = STATUS_STRIPE[call.call_status ?? ''] ?? '#3f3f46'
  const isProcessingOrLive = call.call_status === 'live' || call.call_status === 'processing'
  const bubbleColor = GOOD_STATUSES.has(call.call_status ?? '') ? IMESSAGE_BLUE : IMESSAGE_GREEN

  const topics = call.key_topics ?? expandData?.key_topics ?? []
  const sentiment = call.sentiment ?? expandData?.sentiment ?? null

  async function handleExpand() {
    if (isProcessingOrLive) return
    const next = !expanded
    setExpanded(next)

    if (next && !expandData) {
      setLoading(true)
      const { data } = await supabase
        .from('call_logs')
        .select('transcript, key_topics, next_steps, confidence, sentiment')
        .eq('id', call.id)
        .single()
      setExpandData(data as ExpandedData | null)
      setLoading(false)
    }

    // Check recording availability once per lifecycle (fire-and-forget)
    if (next && recordingAvailable === null && !recordingLoading && RECORDING_STATUSES.has(call.call_status ?? '')) {
      setRecordingLoading(true)
      fetch(`/api/dashboard/calls/${call.ultravox_call_id}/recording`, {
        headers: { Range: 'bytes=0-0' },
      })
        .then(r => setRecordingAvailable(r.ok || r.status === 206))
        .catch(() => setRecordingAvailable(false))
        .finally(() => setRecordingLoading(false))
    }
  }

  const transcriptMsgs = (expandData?.transcript ?? []) as TranscriptMsg[]
  const nextSteps = call.next_steps ?? expandData?.next_steps ?? null
  const shownTopics = topics.slice(0, 3)
  const extraTopics = topics.length - shownTopics.length

  return (
    <div
      className={`border-b transition-colors${call.call_status === 'JUNK' ? ' opacity-[0.55]' : ''}`}
      style={{ borderBottomColor: "var(--color-border)", borderLeft: `3px solid ${stripeColor}` }}
    >
      {/* Main row — div instead of button to allow nested interactive elements */}
      <div
        role="button"
        tabIndex={isProcessingOrLive ? -1 : 0}
        onClick={!isProcessingOrLive ? handleExpand : undefined}
        onKeyDown={!isProcessingOrLive ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand() }
        } : undefined}
        className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.07] hover:brightness-105 transition-all duration-200 group ${isProcessingOrLive ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {/* Line 1: phone + status + call-back + meta */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-[13px] font-medium tracking-tight shrink-0" style={{ color: "var(--color-text-1)" }}>
            {call.caller_phone || 'Unknown'}
          </span>
          <StatusBadge status={call.call_status} showDot={false} />

          {/* HOT lead call-back button */}
          {call.call_status === 'HOT' && call.caller_phone && onCallBack && (
            <button
              onClick={e => { e.stopPropagation(); onCallBack(call.caller_phone!) }}
              className="shrink-0 border border-green-500/40 text-green-400 text-[10px] rounded-full px-2 py-0.5 hover:bg-green-500/10 transition-colors"
            >
              Call Back
            </button>
          )}

          {call.service_type && call.service_type !== 'other' && (
            <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:block" style={{ color: "var(--color-text-3)" }}>
              {call.service_type.replace(/_/g, ' ')}
            </span>
          )}
          {showBusiness && (
            <span className="text-[11px] truncate hidden md:block flex-1" style={{ color: "var(--color-text-2)" }}>
              {call.business_name || '—'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {dur && (
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-3)" }}>{dur}</span>
            )}
            <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-3)" }}>{timeAgo(call.started_at)}</span>
            {!isProcessingOrLive && (
              <motion.svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.18 }}
                className="transition-colors shrink-0"
                style={{ color: "var(--color-text-3)" }}
              >
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.svg>
            )}
          </div>
        </div>

        {/* Line 2: summary */}
        <p
          className="text-xs italic truncate leading-snug mb-1.5 pr-4"
          style={{ color: "var(--color-text-3)" }}
        >
          {call.call_status === 'processing'
            ? 'Analyzing call…'
            : call.ai_summary && call.ai_summary !== 'Call transcript unavailable or too short to classify.'
            ? `${call.ai_summary.slice(0, 80)}${call.ai_summary.length > 80 ? '…' : ''}`
            : 'No summary yet'}
        </p>

        {/* HOT: inline recommended action */}
        {call.call_status === 'HOT' && nextSteps && !isProcessingOrLive && (
          <p className="text-[11px] font-medium truncate mb-1 pr-4" style={{ color: 'rgba(251,191,36,0.85)' }}>
            → {nextSteps.slice(0, 80)}{nextSteps.length > 80 ? '…' : ''}
          </p>
        )}

        {/* Line 3: topics + confidence + sentiment */}
        {!isProcessingOrLive && (
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {shownTopics.map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-hover)] border whitespace-nowrap"
                style={{ color: "var(--color-text-1)", borderColor: "var(--color-border)" }}
              >
                {t}
              </span>
            ))}
            {extraTopics > 0 && (
              <span className="text-[10px] font-mono" style={{ color: "var(--color-text-3)" }}>+{extraTopics}</span>
            )}
            {sentiment && sentiment !== 'neutral' && (
              <span
                className="ml-auto text-[10px] font-mono capitalize shrink-0"
                style={{
                  color: sentiment === 'positive' ? 'rgba(74,222,128,0.6)' :
                    sentiment === 'negative' || sentiment === 'frustrated' ? 'rgba(248,113,113,0.6)' :
                    "var(--color-text-3)"
                }}
              >
                {sentiment}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "var(--color-border)" }}>
              {loading && (
                <p className="text-[11px] py-3" style={{ color: "var(--color-text-3)" }}>Loading…</p>
              )}

              {!loading && (
                <div className="pt-3 space-y-3">
                  {/* Next steps */}
                  {nextSteps && (
                    <div className="flex items-start gap-2.5 pl-3 py-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/15">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 mt-0.5 shrink-0">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p className="text-[11px] text-amber-400/90 font-medium leading-relaxed">{nextSteps}</p>
                    </div>
                  )}

                  {/* All topics */}
                  {(expandData?.key_topics ?? call.key_topics ?? []).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {(expandData?.key_topics ?? call.key_topics ?? []).map(t => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[var(--color-hover)] border"
                          style={{ color: "var(--color-text-1)", borderColor: "var(--color-border)" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Audio player — compact skeleton while checking, player if available */}
                  {recordingLoading && (
                    <div className="h-[72px] rounded-xl" style={{
                      background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-hover) 50%, var(--color-surface) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                  )}
                  {!recordingLoading && recordingAvailable && (
                    <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
                      <AudioWaveformPlayer callId={call.ultravox_call_id} />
                    </div>
                  )}

                  {/* Transcript — iPhone iMessage-style chat bubbles */}
                  {transcriptMsgs.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {transcriptMsgs.slice(0, 6).map((m, i) => {
                        const isAgent = m.role === 'agent'
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.04 }}
                            className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                          >
                            <span className={`text-[9px] mb-0.5 ${isAgent ? 'mr-1' : 'ml-1'}`} style={{ color: isAgent ? bubbleColor : "var(--color-text-3)" }}>
                              {isAgent ? 'AI' : 'Caller'}
                            </span>
                            <div
                              className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                                isAgent ? 'rounded-tr-sm' : 'rounded-tl-sm'
                              }`}
                              style={{
                                backgroundColor: isAgent ? bubbleColor : "var(--color-bg-raised)",
                                color: isAgent ? "#FFFFFF" : "var(--color-text-1)",
                              }}
                            >
                              {m.text}
                            </div>
                          </motion.div>
                        )
                      })}
                      {transcriptMsgs.length > 6 && (
                        <p className="text-[10px] text-center pt-1" style={{ color: "var(--color-text-3)" }}>
                          +{transcriptMsgs.length - 6} more messages
                        </p>
                      )}
                    </div>
                  )}

                  {/* Full call link */}
                  <Link
                    href={`/dashboard/calls/${call.ultravox_call_id}`}
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                    style={{ color: "var(--color-primary)" }}
                  >
                    View full call
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
