'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import StatusBadge from './StatusBadge'
import LiveDuration from './LiveDuration'
import CallRowExpanded, { CallLog, ExpandedData } from './CallRowExpanded'

export type { CallLog }

const TRANSFER_BADGE: Record<string, { label: string; color: string; pulse?: boolean }> = {
  transferring: { label: 'Transferring...', color: 'blue', pulse: true },
  completed:    { label: 'Transferred',     color: 'green' },
  recovered:    { label: 'Recovered by AI', color: 'green' },
  no_answer:    { label: 'No Answer',       color: 'amber' },
  busy:         { label: 'Busy',            color: 'amber' },
  failed:       { label: 'Transfer Failed', color: 'red' },
  canceled:     { label: 'Canceled',        color: 'amber' },
}

const SMS_OUTCOME_BADGE: Record<string, { label: string; color: string }> = {
  sent:                 { label: 'SMS Sent',   color: 'green' },
  blocked_opt_out:      { label: 'Opted Out',  color: 'amber' },
  failed_provider:      { label: 'SMS Failed', color: 'red'   },
  failed_missing_phone: { label: 'No Phone',   color: 'zinc'  },
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
  const nextSteps = call.next_steps ?? expandData?.next_steps ?? null

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

  const shownTopics = topics.slice(0, 3)
  const extraTopics = topics.length - shownTopics.length

  return (
    <div
      className={`border-b b-theme transition-colors${call.call_status === 'JUNK' ? ' opacity-[0.55]' : ''}`}
      style={{ borderLeft: `3px solid ${stripeColor}` }}
    >
      {/* Main row — div instead of button to allow nested interactive elements */}
      <div
        role="button"
        tabIndex={isProcessingOrLive ? -1 : 0}
        onClick={!isProcessingOrLive ? handleExpand : undefined}
        onKeyDown={!isProcessingOrLive ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand() }
        } : undefined}
        className={`w-full text-left px-4 py-3 hover:bg-hover hover:brightness-105 transition-all duration-200 group ${isProcessingOrLive ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {/* Line 1: phone + status + call-back + meta */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-[13px] font-medium tracking-tight shrink-0" style={{ color: "var(--color-text-1)" }}>
            {call.caller_phone === 'trial-test' ? 'Your test call' : (call.caller_phone || 'Unknown')}
          </span>
          <StatusBadge status={call.call_status} showDot={false} />

          {/* Transfer status badge */}
          {call.transfer_status && TRANSFER_BADGE[call.transfer_status] && (() => {
            const b = TRANSFER_BADGE[call.transfer_status!]
            const colorMap: Record<string, string> = {
              blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
              green: 'bg-green-500/15 text-green-400 border-green-500/30',
              amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              red: 'bg-red-500/15 text-red-400 border-red-500/30',
            }
            return (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorMap[b.color] ?? ''} ${b.pulse ? 'animate-pulse' : ''}`}>
                {b.label}
              </span>
            )
          })()}

          {/* SMS outcome badge */}
          {call.sms_outcome && SMS_OUTCOME_BADGE[call.sms_outcome] && (() => {
            const b = SMS_OUTCOME_BADGE[call.sms_outcome!]
            const colorMap: Record<string, string> = {
              green: 'bg-green-500/15 text-green-400 border-green-500/30',
              amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              red:   'bg-red-500/15 text-red-400 border-red-500/30',
              zinc:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
            }
            return (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorMap[b.color] ?? ''}`}>
                {b.label}
              </span>
            )
          })()}

          {/* Callback preference annotation */}
          {call.callback_preference && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/25 shrink-0">
              📅 {call.callback_preference}
            </span>
          )}

          {/* HOT lead call-back button */}
          {call.call_status === 'HOT' && call.caller_phone && call.caller_phone !== 'trial-test' && onCallBack && (
            <button
              onClick={e => { e.stopPropagation(); onCallBack(call.caller_phone!) }}
              className="shrink-0 border border-green-500/40 text-green-400 text-[10px] rounded-full px-2 py-0.5 hover:bg-green-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
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
          {/* TYPE badge — Inbound / Outbound */}
          <span
            className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0"
            style={call.call_direction === 'outbound'
              ? { backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.25)' }
              : { backgroundColor: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.25)' }
            }
          >
            {call.call_direction === 'outbound' ? 'Outbound' : 'Inbound'}
          </span>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {call.call_status === 'live' ? (
              <LiveDuration startedAt={call.started_at} className="text-[11px] font-mono text-green-400" />
            ) : dur ? (
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-3)" }}>{dur}</span>
            ) : null}
            <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-3)" }}>{timeAgo(call.started_at)}</span>
            {call.call_status === 'live' ? (
              <Link
                href={`/dashboard/calls/${call.ultravox_call_id}`}
                onClick={e => e.stopPropagation()}
                className="text-[10px] font-semibold text-green-400 hover:text-green-300 transition-colors shrink-0 animate-pulse"
              >
                Watch Live →
              </Link>
            ) : !isProcessingOrLive && (
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
      <CallRowExpanded
        call={call}
        expandData={expandData}
        loading={loading}
        recordingAvailable={recordingAvailable}
        recordingLoading={recordingLoading}
        bubbleColor={bubbleColor}
        expanded={expanded}
      />
    </div>
  )
}
