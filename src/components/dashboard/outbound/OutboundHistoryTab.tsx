'use client'

import { useState, useEffect } from 'react'
import { Eye, PhoneCall, PhoneMissed, Phone } from 'lucide-react'

interface OutboundCall {
  id: string
  caller_phone: string
  caller_name: string | null
  call_status: string
  ai_summary: string | null
  started_at: string
  duration_seconds: number | null
}

interface OutboundHistoryTabProps {
  clientId: string | null
}

function statusIcon(status: string) {
  if (status === 'completed') return <PhoneCall className="h-4 w-4 shrink-0" style={{ color: '#22c55e' }} />
  if (status === 'no_answer' || status === 'missed') return <PhoneMissed className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
  return <Phone className="h-4 w-4 shrink-0" style={{ color: '#3b82f6' }} />
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function OutboundHistoryTab({ clientId }: OutboundHistoryTabProps) {
  const [calls, setCalls] = useState<OutboundCall[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    fetch(`/api/dashboard/leads/history?client_id=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => setCalls(d.calls ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (!clientId) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Select a client to view outbound history.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-3)' }}>Loading…</div>
  }

  if (calls.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <Eye className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-3)' }} />
        <h2 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-1)' }}>No outbound calls yet</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
          Calls placed from the Composer tab will appear here with AI summaries.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs px-1" style={{ color: 'var(--color-text-3)' }}>
        {calls.length} outbound call{calls.length !== 1 ? 's' : ''} — most recent first
      </p>
      {calls.map(call => (
        <div
          key={call.id}
          className="flex items-start gap-3 p-3 rounded-xl"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div className="mt-0.5">{statusIcon(call.call_status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
                {call.caller_name ?? call.caller_phone}
              </span>
              {call.caller_name && (
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-3)' }}>
                  {call.caller_phone}
                </span>
              )}
            </div>
            {call.ai_summary && (
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-2)' }}>
                {call.ai_summary.slice(0, 180)}{call.ai_summary.length > 180 ? '…' : ''}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] mt-1" style={{ color: 'var(--color-text-3)' }}>
              <span>{formatDate(call.started_at)}</span>
              <span>·</span>
              <span>{formatDuration(call.duration_seconds)}</span>
              <span>·</span>
              <span className="capitalize">{call.call_status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
