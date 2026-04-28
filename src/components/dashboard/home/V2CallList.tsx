'use client'

/**
 * V2CallList — slim recent-calls list for `/dashboard/v2`.
 *
 * Mirrors the mockup's compact list: badge (Live / HOT / WARM / Test) + phone or
 * snippet + meta time. Click any row → `call` modal via openModal callback.
 *
 * Reuses the same useCallLog hook as OverviewCallLog so realtime updates +
 * client scoping stay identical. v1's OverviewCallLog is untouched.
 */

import Link from 'next/link'
import { useCallLog } from '@/hooks/useCallLog'
import type { CallLog } from '@/components/dashboard/CallRow'

export type RowSnapshot = {
  id: string
  ultravox_call_id: string | null
  caller_phone: string | null
  call_status: string
  duration_seconds: number | null
  started_at: string
  ai_summary: string | null
  sentiment: string | null
}

interface Props {
  clientId: string | null
  hasTwilioNumber: boolean
  twilioNumber: string | null
  limit?: number
  onRowClick: (snapshot: RowSnapshot) => void
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function badgeFor(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'live':       return { label: 'Live', bg: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)' }
    case 'HOT':        return { label: 'HOT', bg: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' }
    case 'WARM':       return { label: 'WARM', bg: 'rgba(245,158,11,0.15)', color: 'rgb(245,158,11)' }
    case 'COLD':       return { label: 'COLD', bg: 'rgba(96,165,250,0.15)', color: 'rgb(96,165,250)' }
    case 'JUNK':       return { label: 'JUNK', bg: 'rgba(63,63,70,0.5)', color: 'var(--color-text-3)' }
    case 'MISSED':     return { label: 'MISSED', bg: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)' }
    case 'test':       return { label: 'Test', bg: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)' }
    case 'processing': return { label: 'Processing', bg: 'rgba(234,179,8,0.15)', color: 'rgb(234,179,8)' }
    case 'VOICEMAIL':  return { label: 'Voicemail', bg: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }
    default:           return { label: status, bg: 'var(--color-hover)', color: 'var(--color-text-3)' }
  }
}

function rowLabel(call: CallLog): string {
  if (call.call_status === 'test') return 'Browser test call'
  const phone = formatPhone(call.caller_phone)
  if (call.ai_summary) {
    const trimmed = call.ai_summary.trim()
    const snippet = trimmed.length > 60 ? trimmed.slice(0, 60).trim() + '…' : trimmed
    return `${phone} — ${snippet}`
  }
  return phone
}

function toSnapshot(call: CallLog): RowSnapshot {
  return {
    id: call.id,
    ultravox_call_id: call.ultravox_call_id ?? null,
    caller_phone: call.caller_phone,
    call_status: call.call_status ?? 'unknown',
    duration_seconds: call.duration_seconds,
    started_at: call.started_at,
    ai_summary: call.ai_summary,
    sentiment: call.sentiment ?? null,
  }
}

export default function V2CallList({ clientId, hasTwilioNumber, twilioNumber, limit = 5, onRowClick }: Props) {
  const { calls, loading } = useCallLog(clientId, limit + 5)
  const visible = calls.slice(0, limit)

  return (
    <div
      className="rounded-2xl"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Recent calls</p>
        <Link
          href="/dashboard/calls"
          className="text-[11px] font-semibold hover:opacity-75 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          View all →
        </Link>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center">
          <span
            className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : visible.length === 0 ? (
        <V2EmptyCallList hasTwilioNumber={hasTwilioNumber} twilioNumber={twilioNumber} />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {visible.map(call => {
            const b = badgeFor(call.call_status ?? 'unknown')
            return (
              <button
                key={call.id}
                type="button"
                onClick={() => onRowClick(toSnapshot(call))}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-hover transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide"
                    style={{ backgroundColor: b.bg, color: b.color }}
                  >
                    {b.label}
                  </span>
                  <span className="text-[12px] t1 truncate">{rowLabel(call)}</span>
                </div>
                <span className="text-[11px] t3 shrink-0">{timeAgo(call.started_at)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function V2EmptyCallList({ hasTwilioNumber, twilioNumber }: { hasTwilioNumber: boolean; twilioNumber: string | null }) {
  function copyNumber() {
    if (!twilioNumber) return
    navigator.clipboard.writeText(twilioNumber).catch(() => {})
  }
  return (
    <div className="px-4 py-6 text-center space-y-2">
      <p className="text-[12px] t2">No calls yet — share your number to start receiving them.</p>
      {hasTwilioNumber && twilioNumber && (
        <button
          type="button"
          onClick={copyNumber}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity"
          style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          Copy {twilioNumber}
        </button>
      )}
    </div>
  )
}
