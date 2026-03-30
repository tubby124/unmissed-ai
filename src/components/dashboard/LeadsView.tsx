'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { PhoneOutgoing, ExternalLink } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { slaTag } from '@/lib/utils/sla'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FollowUpStatus = 'contacted' | 'booked' | 'dead' | null

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  key_topics: string[] | null
  started_at: string | null
  created_at: string
  next_steps: string | null
  follow_up_status: FollowUpStatus
  client_id?: string | null
}

type Filter = 'all' | 'HOT' | 'WARM'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'HOT', label: 'HOT' },
  { value: 'WARM', label: 'WARM' },
]

const FOLLOW_UP_OPTIONS: { status: FollowUpStatus; label: string; cls: string }[] = [
  { status: 'contacted', label: 'Contacted', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { status: 'booked', label: 'Booked', cls: 'bg-green-500/10 text-green-400 border-green-500/30' },
  { status: 'dead', label: 'Dead', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function exportLeadsCsv(calls: CallLog[]) {
  const headers = ['Date', 'Phone', 'Summary', 'Topics', 'Status', 'Follow-up', 'Age (hours)']
  const rows = calls.map(c => {
    const ts = c.started_at ?? c.created_at
    const age = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)
    return [
      new Date(ts).toISOString(),
      c.caller_phone ?? '',
      (c.ai_summary ?? '').replace(/"/g, '""'),
      (c.key_topics ?? []).join('; '),
      c.call_status ?? '',
      c.follow_up_status ?? '',
      String(age),
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface LeadsViewProps {
  initialCalls: CallLog[]
  clientId: string
}

export default function LeadsView({ initialCalls, clientId }: LeadsViewProps) {
  const [calls, setCalls] = useState<CallLog[]>(initialCalls)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailCall, setDetailCall] = useState<CallLog | null>(null)
  const [savingFollowUp, setSavingFollowUp] = useState<string | null>(null)
  const [addingToQueue, setAddingToQueue] = useState<Set<string>>(new Set())
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const supabase = createBrowserClient()

  async function updateFollowUp(callId: string, status: FollowUpStatus) {
    if (savingFollowUp) return
    setSavingFollowUp(callId)
    try {
      const res = await fetch('/api/dashboard/leads/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callLogId: callId, status }),
      })
      if (res.ok) {
        const newStatus = status
        setCalls(prev => prev.map(c => c.id === callId ? { ...c, follow_up_status: newStatus } : c))
        setDetailCall(prev => prev?.id === callId ? { ...prev, follow_up_status: newStatus } : prev)
      }
    } finally {
      setSavingFollowUp(null)
    }
  }

  async function addToQueue(call: CallLog) {
    if (!call.caller_phone) return
    setAddingToQueue(prev => new Set(prev).add(call.id))
    try {
      const res = await fetch('/api/dashboard/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: call.caller_phone,
          notes: call.ai_summary ? call.ai_summary.slice(0, 200) : null,
        }),
      })
      if (res.ok) {
        setQueuedIds(prev => new Set(prev).add(call.id))
      }
    } finally {
      setAddingToQueue(prev => { const s = new Set(prev); s.delete(call.id); return s })
    }
  }

  async function bulkAddToQueue() {
    const toAdd = filtered.filter(c => selected.has(c.id) && c.caller_phone && !queuedIds.has(c.id))
    await Promise.all(toAdd.map(c => addToQueue(c)))
    setSelected(new Set())
  }

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads_view_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        if (!['HOT', 'WARM'].includes(row.call_status ?? '')) return
        if (row.client_id !== clientId) return
        setCalls(prev => {
          if (prev.some(c => c.id === row.id)) return prev
          return [row, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, (payload) => {
        const row = payload.new as CallLog
        if (row.client_id !== clientId) return
        setCalls(prev => {
          const existing = prev.find(c => c.id === row.id)
          if (existing) {
            return prev.map(c => c.id === row.id ? { ...c, ...row } : c)
          }
          if (['HOT', 'WARM'].includes(row.call_status ?? '')) {
            return [row, ...prev]
          }
          return prev
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = calls.filter(c =>
    filter === 'all' ? true : c.call_status === filter
  )

  const counts = {
    all: calls.length,
    HOT: calls.filter(c => c.call_status === 'HOT').length,
    WARM: calls.filter(c => c.call_status === 'WARM').length,
  }

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))
  const someSelected = filtered.some(c => selected.has(c.id))
  const selectedCount = filtered.filter(c => selected.has(c.id)).length

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.delete(c.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.add(c.id)); return s })
    }
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  return (
    <div className="space-y-4">
      {/* Contact Detail Dialog */}
      <Dialog open={!!detailCall} onOpenChange={open => { if (!open) setDetailCall(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailCall?.caller_phone ?? 'Unknown'}</DialogTitle>
            <DialogDescription>
              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border mr-2 ${
                detailCall?.call_status === 'HOT'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {detailCall?.call_status}
              </span>
              {timeAgo(detailCall?.started_at ?? null)}
            </DialogDescription>
          </DialogHeader>
          {detailCall && (
            <div className="space-y-4 text-sm mt-1">
              {detailCall.ai_summary && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-3)' }}>Summary</p>
                  <p className="text-xs italic leading-relaxed" style={{ color: 'var(--color-text-2)' }}>{detailCall.ai_summary}</p>
                </div>
              )}
              {detailCall.next_steps && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-3)' }}>Next Steps</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-2)' }}>{detailCall.next_steps}</p>
                </div>
              )}
              {(detailCall.key_topics ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--color-text-3)' }}>Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {(detailCall.key_topics ?? []).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--color-text-3)' }}>Follow-up</p>
                <div className="flex gap-1.5 flex-wrap">
                  {FOLLOW_UP_OPTIONS.map(opt => (
                    <button
                      key={opt.status}
                      onClick={() => updateFollowUp(detailCall.id, detailCall.follow_up_status === opt.status ? null : opt.status)}
                      disabled={savingFollowUp === detailCall.id}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-40 ${
                        detailCall.follow_up_status === opt.status
                          ? opt.cls
                          : 'border-[var(--color-border)] text-[var(--color-text-3)] hover:border-current'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {detailCall?.caller_phone && (
              <Button
                variant="outline"
                onClick={() => addToQueue(detailCall)}
                disabled={addingToQueue.has(detailCall.id) || queuedIds.has(detailCall.id)}
              >
                <PhoneOutgoing className="h-3.5 w-3.5 mr-1.5" />
                {queuedIds.has(detailCall.id) ? 'In Queue' : addingToQueue.has(detailCall.id) ? 'Adding…' : 'Add to Queue'}
              </Button>
            )}
            <Link href={`/dashboard/calls/${detailCall?.ultravox_call_id}`}>
              <Button variant="ghost">
                View Call
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-1)' }}>Leads</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            Inbound calls that need follow-up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
            style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            {filtered.length}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={() => exportLeadsCsv(filtered)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold hover:bg-[var(--color-hover)] transition-all"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Table container */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {/* Filter tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setSelected(new Set()) }}
              style={{ touchAction: 'manipulation' }}
              className="relative flex-1 min-h-[44px] px-4 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {filter === f.value && (
                <motion.div
                  layoutId="leads-filter-bg"
                  className="absolute inset-0 bg-blue-500/10 border-b-2 border-blue-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className={`relative flex items-center justify-center gap-1.5 ${filter === f.value ? 'text-blue-400' : ''}`}
                style={filter === f.value ? undefined : { color: 'var(--color-text-3)' }}>
                {f.label}
                {counts[f.value] > 0 && (
                  <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none ${
                    filter === f.value ? 'bg-blue-500/20 text-blue-400'
                    : f.value === 'HOT' ? 'bg-red-500/20 text-red-400'
                    : f.value === 'WARM' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {counts[f.value]}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-3 px-4 py-2 border-b text-xs"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-hover)' }}>
            <span style={{ color: 'var(--color-text-2)' }}>{selectedCount} selected</span>
            <button
              onClick={bulkAddToQueue}
              disabled={isPending}
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            >
              Add to Outbound Queue
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto font-medium transition-colors"
              style={{ color: 'var(--color-text-3)' }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: 'var(--color-text-3)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-30">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>No leads yet</p>
            <p className="text-xs text-center max-w-[220px]" style={{ color: 'var(--color-text-3)' }}>
              Hot and warm calls will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pr-0">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(call => {
                  const sla = slaTag(call.started_at)
                  const ts = call.started_at ?? call.created_at
                  const topics = call.key_topics ?? []
                  const isChecked = selected.has(call.id)
                  const inQueue = queuedIds.has(call.id)
                  const adding = addingToQueue.has(call.id)
                  const followUp = FOLLOW_UP_OPTIONS.find(o => o.status === call.follow_up_status)

                  return (
                    <TableRow
                      key={call.id}
                      className={`transition-colors ${isChecked ? 'bg-blue-500/5' : ''}`}
                    >
                      <TableCell className="w-10 pr-0">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleRow(call.id)} />
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          call.call_status === 'HOT'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {call.call_status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-mono text-[13px] font-medium" style={{ color: 'var(--color-text-1)' }}>
                            {call.caller_phone ?? 'Unknown'}
                          </span>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>{timeAgo(ts)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-[12px] italic truncate max-w-[200px]" style={{ color: 'var(--color-text-3)' }}>
                          {call.ai_summary ? call.ai_summary.slice(0, 80) + (call.ai_summary.length > 80 ? '…' : '') : '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {topics.slice(0, 2).map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full border"
                              style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                              {t}
                            </span>
                          ))}
                          {topics.length > 2 && (
                            <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>+{topics.length - 2}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sla ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sla.cls}`}>
                            {sla.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-3)' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {followUp ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${followUp.cls}`}>
                            {followUp.label}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center gap-1 justify-end">
                          {call.caller_phone && (
                            <button
                              onClick={() => addToQueue(call)}
                              disabled={adding || inQueue}
                              title={inQueue ? 'Already in outbound queue' : 'Add to outbound queue'}
                              className={`p-1.5 rounded-lg transition-colors text-[10px] font-semibold ${
                                inQueue
                                  ? 'text-green-400 bg-green-500/10'
                                  : 'hover:bg-blue-500/10 text-blue-400'
                              } disabled:opacity-50`}
                            >
                              <PhoneOutgoing className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailCall(call)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-hover)]"
                            style={{ color: 'var(--color-text-3)' }}
                            title="View details"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
