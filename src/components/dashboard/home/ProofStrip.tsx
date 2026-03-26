'use client'

/**
 * ProofStrip — AC-2
 *
 * Shows last completed call summary as a proof of life strip.
 * Data contract:
 * - Only renders when most recent call has ended (not 'live')
 * - test vs live classification: call_status === 'test' | 'trial_test_completed'
 * - ai_summary may be null for test calls — degrades honestly
 * - transcript link goes to call detail via ultravox_call_id when present and non-test
 * - gap-detection suggestion: derived from hasHours/hasFaqs/hasForwardingNumber (same logic as PostCallPanel)
 */

import Link from 'next/link'

interface ProofStripProps {
  call: {
    id: string
    ultravox_call_id: string | null
    call_status: string
    duration_seconds: number | null
    started_at: string
    ai_summary: string | null
  }
  hasHours: boolean
  hasFaqs: boolean
  hasForwardingNumber: boolean
  onRetest?: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function getGapSuggestion(hasHours: boolean, hasFaqs: boolean, hasForwardingNumber: boolean): string | null {
  if (!hasHours) return 'Try adding your business hours so the agent can tell callers when you\'re open.'
  if (!hasFaqs) return 'Add an FAQ so your agent can answer common questions correctly.'
  if (!hasForwardingNumber) return 'Set a forwarding number so warm leads can reach a human.'
  return null
}

export default function ProofStrip({
  call,
  hasHours,
  hasFaqs,
  hasForwardingNumber,
  onRetest,
}: ProofStripProps) {
  const isTestCall = call.call_status === 'test' || call.call_status === 'trial_test_completed'
  const isLive = call.call_status === 'live'
  // Don't show strip for in-progress calls
  if (isLive) return null

  const summary = call.ai_summary ?? (isTestCall ? 'Test call completed — no summary available.' : null)
  const suggestion = getGapSuggestion(hasHours, hasFaqs, hasForwardingNumber)
  const callDetailHref = !isTestCall && call.ultravox_call_id
    ? `/dashboard/calls/${call.ultravox_call_id}`
    : null

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{
        background: isTestCall
          ? 'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))'
          : 'var(--color-success-tint)',
        border: isTestCall
          ? '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)'
          : '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
      }}
    >
      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: isTestCall ? 'var(--color-primary)' : 'var(--color-success)' }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold t1">
            {isTestCall ? 'Last test call' : 'Last call'}
          </span>
          <span className="text-[11px] t3">{timeAgo(call.started_at)}</span>
          <span className="text-[11px] t3">·</span>
          <span className="text-[11px] t3">{formatDuration(call.duration_seconds)}</span>
        </div>

        {summary && (
          <p className="text-xs t3 mt-0.5 leading-relaxed truncate max-w-prose">{summary}</p>
        )}

        {suggestion && (
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--color-primary)' }}>
            💡 {suggestion}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {callDetailHref && (
          <Link
            href={callDetailHref}
            className="text-[11px] font-medium t3 hover:opacity-75 transition-opacity"
          >
            View
          </Link>
        )}
        {onRetest && isTestCall && (
          <button
            onClick={onRetest}
            className="text-[11px] font-semibold transition-opacity hover:opacity-75"
            style={{ color: 'var(--color-primary)' }}
          >
            Retest →
          </button>
        )}
      </div>
    </div>
  )
}
