'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Phone, Headphones, ExternalLink, Ban, PauseCircle, CheckCircle2,
  Clock, RotateCcw, ListChecks, ChevronDown,
} from 'lucide-react'
import { MANUAL_OUTCOMES, MANUAL_OUTCOME_LABELS } from '@/lib/outcome-desk'

interface OutcomeLead {
  id: string
  name: string | null
  phone: string
  status: string | null
  disposition: string | null
  lead_status: string | null
  call_count: number
  last_called_at: string | null
  scheduled_callback_at: string | null
  lofty_lead_id: string | null
  writeback_state: 'synced' | 'failed' | 'pending' | 'n/a'
  summary: string | null
  next_action: string | null
  recording_url: string | null
  lofty_record_url: string | null
}

interface CallOutcomeDeskProps {
  clientId: string | null
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  called: 'Called',
  calling: 'Dialing…',
  completed: 'Completed',
  dnc: 'DNC',
  new: 'New',
  no_answer: 'No answer',
  booked: 'Booked',
  closed: 'Closed',
}

const DISPOSITION_LABEL: Record<string, string> = {
  active_now: 'Active now',
  future_timeline: 'Future timeline',
  not_looking: 'Not looking',
  wrong_number: 'Wrong number',
  do_not_call: 'Do not call',
  no_answer: 'No answer',
  voicemail: 'Voicemail',
  answered: 'Answered',
  vm: 'Voicemail',
  'no-answer': 'No answer',
}

const WRITEBACK_STYLE: Record<OutcomeLead['writeback_state'], { label: string; color: string; bg: string }> = {
  synced: { label: 'Synced', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  failed: { label: 'Writeback failed', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  'n/a': { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

function formatNextEligible(iso: string | null): string {
  if (!iso) return 'held'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'due now'
  const mins = Math.floor(diff / 60_000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `in ${hrs}h`
  if (mins > 0) return `in ${mins}m`
  return 'now'
}

export default function CallOutcomeDesk({ clientId }: CallOutcomeDeskProps) {
  const [leads, setLeads] = useState<OutcomeLead[]>([])
  const [canListen, setCanListen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/dashboard/leads/outcomes?client_id=${encodeURIComponent(clientId)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load outcomes'); return }
      setLeads(data.leads ?? [])
      setCanListen(Boolean(data.can_listen))
    } catch {
      setError('Failed to load outcomes')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  // Every mutation reads back server state via a full re-fetch — no
  // optimistic UI success.
  async function runAction(leadId: string, action: string, outcome?: string) {
    setBusy(prev => ({ ...prev, [leadId]: action }))
    setError('')
    try {
      const res = await fetch('/api/dashboard/leads/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, action, outcome }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Action failed')
    } catch {
      setError('Action failed')
    } finally {
      setBusy(prev => {
        const next = { ...prev }
        delete next[leadId]
        return next
      })
      await load()
    }
  }

  async function retryWriteback(leadId: string) {
    setBusy(prev => ({ ...prev, [leadId]: 'retry_writeback' }))
    setError('')
    try {
      const res = await fetch('/api/dashboard/leads/writeback-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Retry failed')
    } catch {
      setError('Retry failed')
    } finally {
      setBusy(prev => {
        const next = { ...prev }
        delete next[leadId]
        return next
      })
      await load()
    }
  }

  if (!clientId) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Select a client to view call outcomes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs px-1" style={{ color: 'var(--color-text-3)' }}>
          {leads.length} lead{leads.length !== 1 ? 's' : ''} — approve one at a time; nothing dials without an explicit approval
        </p>
        <button
          onClick={load}
          title="Refresh"
          className="p-2 rounded-xl border transition-colors hover:opacity-70"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <RotateCcw className="h-3.5 w-3.5" style={{ color: 'var(--color-text-3)' }} />
        </button>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-3)' }}>Loading outcomes…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <ListChecks className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-text-3)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-1)' }}>No campaign leads yet</p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Import leads from the Composer tab, then track their call outcomes here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => {
            const dispLabel = lead.disposition ? (DISPOSITION_LABEL[lead.disposition] ?? lead.disposition) : null
            const statusLabel = STATUS_LABEL[lead.status ?? ''] ?? lead.status
            const wb = WRITEBACK_STYLE[lead.writeback_state] ?? WRITEBACK_STYLE['n/a']
            const isBusy = Boolean(busy[lead.id])
            return (
              <div
                key={lead.id}
                className="rounded-2xl p-3"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                {/* Header: identity + state chips */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
                      {lead.name ?? 'Unknown'}
                    </div>
                    <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>
                      {formatPhone(lead.phone)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    {dispLabel && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                        {dispLabel}
                      </span>
                    )}
                    {statusLabel && !dispLabel && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>
                        {statusLabel}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: wb.bg, color: wb.color }}>
                      Lofty: {wb.label}
                    </span>
                  </div>
                </div>

                {/* Attempts + next eligible */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1.5" style={{ color: 'var(--color-text-3)' }}>
                  <span className="font-semibold" style={{ color: 'var(--color-text-2)' }}>
                    {lead.call_count} attempt{lead.call_count === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next: {formatNextEligible(lead.scheduled_callback_at)}
                  </span>
                  {lead.last_called_at && <span>· last called {formatNextEligible(lead.last_called_at)}</span>}
                </div>

                {/* Summary + next action */}
                {lead.summary && (
                  <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--color-text-2)' }}>{lead.summary}</p>
                )}
                {lead.next_action && (
                  <p className="text-[11px] mt-1 line-clamp-1" style={{ color: 'var(--color-text-3)' }}>
                    <span className="font-semibold" style={{ color: 'var(--color-text-2)' }}>Next: </span>{lead.next_action}
                  </p>
                )}

                {/* Controls */}
                <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => runAction(lead.id, 'approve_next')}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Approve next 1
                  </button>
                  <button
                    onClick={() => runAction(lead.id, 'hold')}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                    style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}
                  >
                    <PauseCircle className="h-3 w-3" />
                    Hold
                  </button>
                  <button
                    onClick={() => runAction(lead.id, 'dnc')}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                    style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }}
                  >
                    <Ban className="h-3 w-3" />
                    DNC
                  </button>

                  {/* Manual outcome dropdown */}
                  <div className="relative">
                    <select
                      value=""
                      disabled={isBusy}
                      onChange={e => { if (e.target.value) runAction(lead.id, 'manual_outcome', e.target.value) }}
                      className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50"
                      style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)' }}
                    >
                      <option value="" disabled>Outcome…</option>
                      {MANUAL_OUTCOMES.map(o => (
                        <option key={o} value={o}>{MANUAL_OUTCOME_LABELS[o]}</option>
                      ))}
                    </select>
                    <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-3)' }} />
                  </div>

                  {lead.writeback_state === 'failed' && (
                    <button
                      onClick={() => retryWriteback(lead.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                      style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)' }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry writeback
                    </button>
                  )}

                  {/* Listen + Lofty links */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {canListen && lead.recording_url && (
                      <a
                        href={lead.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ color: 'var(--color-cta)', backgroundColor: 'rgba(99,102,241,0.1)' }}
                      >
                        <Headphones className="h-3 w-3" />
                        Listen
                      </a>
                    )}
                    {lead.lofty_record_url && (
                      <a
                        href={lead.lofty_record_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ color: 'var(--color-text-2)', backgroundColor: 'var(--color-hover)' }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Lofty
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
