'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import StatusBadge from './StatusBadge'

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

const STATUS_ARC_COLOR: Record<string, string> = {
  HOT:  '#ef4444',
  WARM: '#f59e0b',
  COLD: '#60a5fa',
  JUNK: '#52525b',
}

const SENTIMENT_GLYPH: Record<string, string> = {
  positive:    '✦',
  neutral:     '—',
  negative:    '↓',
  frustrated:  '⚡',
  indifferent: '·',
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive:    'text-green-400/70',
  neutral:     'text-zinc-500',
  negative:    'text-red-400/70',
  frustrated:  'text-orange-400/70',
  indifferent: 'text-zinc-600',
}

// Semicircle confidence arc (r=13, circumference ≈ 40.84 for 180°)
const ARC_C = 40.84
function ConfidenceArc({ confidence, status }: { confidence: number; status: string }) {
  const fill = Math.max(0, Math.min(100, confidence)) / 100 * ARC_C
  const color = STATUS_ARC_COLOR[status] ?? '#52525b'
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" fill="none" className="shrink-0">
      {/* Track */}
      <path
        d="M2 15 A13 13 0 0 1 28 15"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Fill */}
      <path
        d="M2 15 A13 13 0 0 1 28 15"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${fill} ${ARC_C}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="15" y="13" textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace" opacity={0.8}>
        {confidence}
      </text>
    </svg>
  )
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

export default function CallRow({ call, showBusiness }: { call: CallLog; showBusiness?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [expandData, setExpandData] = useState<ExpandedData | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  const dur = fmtDur(call.duration_seconds)
  const stripeColor = STATUS_STRIPE[call.call_status ?? ''] ?? '#3f3f46'
  const isProcessingOrLive = call.call_status === 'live' || call.call_status === 'processing'

  const topics = call.key_topics ?? expandData?.key_topics ?? []
  const sentiment = call.sentiment ?? expandData?.sentiment ?? null
  const confidence = call.confidence ?? expandData?.confidence ?? null

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
  }

  const transcriptMsgs = (expandData?.transcript ?? []) as TranscriptMsg[]
  const nextSteps = call.next_steps ?? expandData?.next_steps ?? null
  const shownTopics = topics.slice(0, 3)
  const extraTopics = topics.length - shownTopics.length

  return (
    <div
      className="border-b border-white/[0.04] transition-colors"
      style={{ borderLeft: `3px solid ${stripeColor}` }}
    >
      {/* Main row — clickable to expand */}
      <button
        onClick={handleExpand}
        disabled={isProcessingOrLive}
        className="w-full text-left px-4 py-3 hover:bg-white/[0.025] transition-colors disabled:cursor-default group"
      >
        {/* Line 1: phone + status + meta */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-[13px] text-zinc-100 font-medium tracking-tight shrink-0">
            {call.caller_phone || 'Unknown'}
          </span>
          <StatusBadge status={call.call_status} showDot={false} />
          {call.service_type && call.service_type !== 'other' && (
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider hidden sm:block">
              {call.service_type.replace(/_/g, ' ')}
            </span>
          )}
          {showBusiness && (
            <span className="text-[11px] text-zinc-500 truncate hidden md:block flex-1">
              {call.business_name || '—'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {dur && (
              <span className="text-[11px] font-mono text-zinc-600 tabular-nums">{dur}</span>
            )}
            <span className="text-[11px] font-mono text-zinc-600 tabular-nums">{timeAgo(call.started_at)}</span>
            {!isProcessingOrLive && (
              <motion.svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.18 }}
                className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0"
              >
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.svg>
            )}
          </div>
        </div>

        {/* Line 2: summary */}
        <p className="text-sm text-zinc-500 truncate leading-snug mb-1.5 pr-4">
          {call.ai_summary || (call.call_status === 'processing' ? 'Analyzing call…' : '—')}
        </p>

        {/* Line 3: topics + confidence + sentiment */}
        {!isProcessingOrLive && (
          <div className="flex items-center gap-2 flex-wrap">
            {shownTopics.map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-500 bg-white/[0.04] border border-white/[0.06] whitespace-nowrap"
              >
                {t}
              </span>
            ))}
            {extraTopics > 0 && (
              <span className="text-[10px] font-mono text-zinc-600">+{extraTopics}</span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {sentiment && (
                <span className={`text-[13px] ${SENTIMENT_COLOR[sentiment] ?? 'text-zinc-600'}`} title={sentiment}>
                  {SENTIMENT_GLYPH[sentiment] ?? '—'}
                </span>
              )}
              {confidence != null && (
                <ConfidenceArc confidence={confidence} status={call.call_status ?? ''} />
              )}
            </div>
          </div>
        )}
      </button>

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
            <div className="px-4 pb-4 pt-0 border-t border-white/[0.04]">
              {loading && (
                <p className="text-[11px] text-zinc-600 py-3">Loading…</p>
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
                          className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.08]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Transcript preview */}
                  {transcriptMsgs.length > 0 && (
                    <div className="space-y-1.5">
                      {transcriptMsgs.slice(0, 6).map((m, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className={`text-[9px] font-bold tracking-[0.15em] uppercase shrink-0 mt-0.5 w-10 ${
                            m.role === 'agent' ? 'text-blue-400/60' : 'text-zinc-500'
                          }`}>
                            {m.role === 'agent' ? 'AI' : 'Caller'}
                          </span>
                          <p className="text-[12px] text-zinc-500 leading-relaxed">{m.text}</p>
                        </div>
                      ))}
                      {transcriptMsgs.length > 6 && (
                        <p className="text-[10px] text-zinc-700 pl-12">
                          +{transcriptMsgs.length - 6} more messages
                        </p>
                      )}
                    </div>
                  )}

                  {/* Full call link */}
                  <Link
                    href={`/dashboard/calls/${call.ultravox_call_id}`}
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-400/80 hover:text-blue-300 transition-colors"
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
