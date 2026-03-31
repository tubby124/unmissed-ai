'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import AudioWaveformPlayer from './AudioWaveformPlayer'
import { buildCalendarUrl } from '@/lib/calendar-url'

interface FactSuggestion {
  content: string
  kind: string
}

type ExtractState = 'idle' | 'loading' | 'done' | 'saving'

export interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  business_name?: string | null
  client_id?: string | null
  confidence?: number | null
  sentiment?: string | null
  key_topics?: string[] | null
  next_steps?: string | null
  quality_score?: number | null
  transfer_status?: string | null
  sms_outcome?: string | null
  call_direction?: string | null
  callback_preference?: string | null
}

export interface ExpandedData {
  transcript: { role: string; text: string }[] | null
  key_topics: string[] | null
  next_steps: string | null
  confidence: number | null
  sentiment: string | null
}

const SMS_OUTCOME_BADGE: Record<string, { label: string; color: string }> = {
  sent:                 { label: 'SMS Sent',   color: 'green' },
  blocked_opt_out:      { label: 'Opted Out',  color: 'amber' },
  failed_provider:      { label: 'SMS Failed', color: 'red'   },
  failed_missing_phone: { label: 'No Phone',   color: 'zinc'  },
}

const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-500/15 text-green-400 border-green-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red:   'bg-red-500/15 text-red-400 border-red-500/30',
  zinc:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

interface Props {
  call: CallLog
  expandData: ExpandedData | null
  loading: boolean
  recordingAvailable: boolean | null
  recordingLoading: boolean
  bubbleColor: string
  expanded: boolean
}

export default function CallRowExpanded({
  call,
  expandData,
  loading,
  recordingAvailable,
  recordingLoading,
  bubbleColor,
  expanded,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [smsOptOut, setSmsOptOut] = useState<{ opted_out: boolean; opted_out_at: string | null } | null>(null)
  const [extractState, setExtractState] = useState<ExtractState>('idle')
  const [suggestions, setSuggestions] = useState<FactSuggestion[]>([])
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (expanded && call.sms_outcome != null && smsOptOut === null) {
      fetch(`/api/dashboard/calls/${call.ultravox_call_id}/sms-status`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setSmsOptOut({ opted_out: d.opted_out, opted_out_at: d.opted_out_at }))
        .catch(() => {})
    }
  }, [expanded, call.sms_outcome, call.ultravox_call_id, smsOptOut])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    }).catch(() => {})
  }

  async function handleExtractFacts() {
    if (extractState === 'loading') return
    setExtractState('loading')
    setSuggestions([])
    setSavedIndices(new Set())
    try {
      const res = await fetch('/api/dashboard/knowledge/suggest-from-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_log_id: call.id }),
      })
      if (!res.ok) { setExtractState('done'); return }
      const data = await res.json() as { suggestions?: FactSuggestion[] }
      setSuggestions(data.suggestions ?? [])
    } catch {
      // silent — non-critical feature
    } finally {
      setExtractState('done')
    }
  }

  async function handleSaveSuggestion(index: number, content: string) {
    if (savingIndex !== null) return
    setSavingIndex(index)
    try {
      const res = await fetch('/api/dashboard/knowledge/ingest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          title: `Fact from call ${new Date(call.started_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
        }),
      })
      if (res.ok) {
        setSavedIndices(prev => new Set(prev).add(index))
      }
    } catch {
      // silent — non-critical
    } finally {
      setSavingIndex(null)
    }
  }

  const nextSteps = call.next_steps ?? expandData?.next_steps ?? null
  const transcriptMsgs = (expandData?.transcript ?? []) as { role: string; text: string }[]

  return (
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4 pt-0 border-t b-theme">
            {loading && (
              <p className="text-[11px] py-3" style={{ color: 'var(--color-text-3)' }}>Loading…</p>
            )}

            {!loading && (
              <div className="pt-3 space-y-3">
                {/* Full AI Summary */}
                {call.ai_summary && call.ai_summary !== 'Call transcript unavailable or too short to classify.' && (
                  <div className="px-3 py-2.5 rounded-xl bg-[var(--color-hover)] border b-theme">
                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-3)' }}>AI Summary</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-1)' }}>{call.ai_summary}</p>
                  </div>
                )}

                {/* Metadata: confidence · quality · timestamp */}
                {((call.confidence ?? expandData?.confidence) != null || call.quality_score != null) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {(call.confidence ?? expandData?.confidence) != null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>Confidence</span>
                        <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--color-text-1)' }}>
                          {Math.round((call.confidence ?? expandData?.confidence ?? 0) * 100)}%
                        </span>
                      </div>
                    )}
                    {call.quality_score != null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>Quality</span>
                        <span className={`text-[11px] font-mono font-semibold ${
                          call.quality_score >= 8 ? 'text-green-400' :
                          call.quality_score >= 5 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {call.quality_score}/10
                        </span>
                      </div>
                    )}
                    <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-text-3)' }}>
                      {new Date(call.started_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {/* Next steps */}
                {nextSteps && (
                  <div className="flex items-start gap-2.5 pl-3 py-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/15">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 mt-0.5 shrink-0">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-[11px] text-amber-400/90 font-medium leading-relaxed">{nextSteps}</p>
                  </div>
                )}

                {/* SMS status */}
                {call.sms_outcome != null && (() => {
                  const badge = SMS_OUTCOME_BADGE[call.sms_outcome!] ?? { label: 'Unknown', color: 'zinc' }
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-3)' }}>SMS</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COLOR_MAP[badge.color] ?? COLOR_MAP.zinc}`}>
                        {badge.label}
                      </span>
                      {smsOptOut?.opted_out && (
                        <span className="text-[10px] text-amber-400/70">
                          opted out{smsOptOut.opted_out_at ? ` ${new Date(smsOptOut.opted_out_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      )}
                    </div>
                  )
                })()}

                {/* All topics */}
                {(expandData?.key_topics ?? call.key_topics ?? []).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {(expandData?.key_topics ?? call.key_topics ?? []).map(t => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[var(--color-hover)] border"
                        style={{ color: 'var(--color-text-1)', borderColor: 'var(--color-border)' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio player — shimmer skeleton while checking */}
                {recordingLoading && (
                  <div className="h-[72px] rounded-xl" style={{
                    background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-hover) 50%, var(--color-surface) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }} />
                )}
                {!recordingLoading && recordingAvailable && (
                  <div className="rounded-xl overflow-hidden border b-theme">
                    <AudioWaveformPlayer callId={call.ultravox_call_id} />
                  </div>
                )}

                {/* Transcript — iMessage-style chat bubbles */}
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
                          <span className={`text-[9px] mb-0.5 ${isAgent ? 'mr-1' : 'ml-1'}`} style={{ color: isAgent ? bubbleColor : 'var(--color-text-3)' }}>
                            {isAgent ? 'AI' : 'Caller'}
                          </span>
                          <div
                            className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-[12px] leading-relaxed shadow-sm ${isAgent ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                            style={{
                              backgroundColor: isAgent ? bubbleColor : 'var(--color-bg-raised)',
                              color: isAgent ? '#FFFFFF' : 'var(--color-text-1)',
                            }}
                          >
                            {m.text}
                          </div>
                        </motion.div>
                      )
                    })}
                    {transcriptMsgs.length > 6 && (
                      <p className="text-[10px] text-center pt-1" style={{ color: 'var(--color-text-3)' }}>
                        +{transcriptMsgs.length - 6} more messages
                      </p>
                    )}
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5 border-t b-theme">
                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    {call.caller_phone && call.caller_phone !== 'trial-test' && (
                      <button
                        onClick={e => { e.stopPropagation(); copyText(call.caller_phone!, 'phone') }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border b-theme bg-[var(--color-hover)] hover:border-[var(--color-primary)]/40 transition-colors cursor-pointer t2"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {copied === 'phone' ? 'Copied!' : 'Copy Phone'}
                      </button>
                    )}
                    {call.caller_phone && call.caller_phone !== 'trial-test' && (
                      <a
                        href={buildCalendarUrl({
                          callerPhone: call.caller_phone,
                          serviceType: call.service_type,
                          aiSummary: call.ai_summary,
                          nextSteps: nextSteps ?? undefined,
                          callId: call.ultravox_call_id,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border b-theme bg-[var(--color-hover)] hover:border-blue-500/40 hover:text-blue-400 transition-colors cursor-pointer t2"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        + Calendar
                      </a>
                    )}
                    {call.ai_summary && call.ai_summary !== 'Call transcript unavailable or too short to classify.' && (
                      <button
                        onClick={e => { e.stopPropagation(); copyText(call.ai_summary!, 'summary') }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border b-theme bg-[var(--color-hover)] hover:border-[var(--color-primary)]/40 transition-colors cursor-pointer t2"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {copied === 'summary' ? 'Copied!' : 'Copy Summary'}
                      </button>
                    )}

                    {/* Extract facts — only for calls with a real summary */}
                    {call.ai_summary && call.ai_summary !== 'Call transcript unavailable or too short to classify.' && (
                      <button
                        onClick={e => { e.stopPropagation(); void handleExtractFacts() }}
                        disabled={extractState === 'loading'}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: 'var(--color-hover)',
                          borderColor: extractState === 'done' && suggestions.length > 0
                            ? 'rgba(99,102,241,0.4)'
                            : 'var(--color-border)',
                          color: extractState === 'done' && suggestions.length > 0
                            ? 'rgb(165,180,252)'
                            : 'var(--color-text-2)',
                          opacity: extractState === 'loading' ? 0.6 : 1,
                        }}
                      >
                        {extractState === 'loading' ? (
                          <svg className="w-[10px] h-[10px] animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                        {extractState === 'loading'
                          ? 'Extracting…'
                          : extractState === 'done' && suggestions.length > 0
                          ? `${suggestions.length} fact${suggestions.length !== 1 ? 's' : ''} found`
                          : extractState === 'done'
                          ? 'No new facts'
                          : 'Extract facts'}
                      </button>
                    )}

                    <Link
                      href={`/dashboard/calls/${call.ultravox_call_id}`}
                      onClick={e => e.stopPropagation()}
                      className="ml-auto flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      View full call
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Extracted fact suggestions */}
                <AnimatePresence>
                  {extractState === 'done' && suggestions.length > 0 && (
                    <motion.div
                      key="suggestions"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 px-3 py-2.5 rounded-xl border space-y-2"
                        style={{ backgroundColor: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.2)' }}
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgb(165,180,252)' }}>
                          Suggested knowledge additions
                        </p>
                        {suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <p className="flex-1 text-[11px] leading-snug" style={{ color: 'var(--color-text-1)' }}>
                              {s.content}
                              <span className="ml-1.5 text-[9px] font-mono uppercase" style={{ color: 'var(--color-text-3)' }}>
                                {s.kind}
                              </span>
                            </p>
                            <button
                              onClick={e => { e.stopPropagation(); void handleSaveSuggestion(i, s.content) }}
                              disabled={savedIndices.has(i) || savingIndex === i}
                              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
                              style={savedIndices.has(i)
                                ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgb(134,239,172)', border: '1px solid rgba(34,197,94,0.25)', cursor: 'default' }
                                : { backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(165,180,252)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }
                              }
                            >
                              {savingIndex === i
                                ? '…'
                                : savedIndices.has(i)
                                ? 'Saved'
                                : 'Save'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
