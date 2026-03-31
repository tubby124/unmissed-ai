'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Phone, Plus, ExternalLink, CalendarCheck, Loader2, PhoneCall, PhoneOff, Voicemail, Clock } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
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
import { slaTag } from '@/lib/utils/sla'

type Disposition = 'answered' | 'vm' | 'no-answer' | null

type LeadFollowUpStatus = 'new' | 'called_back' | 'booked' | 'closed' | null

interface Lead {
  id: string
  client_id: string | null
  phone: string
  name: string | null
  status: 'queued' | 'called' | 'calling' | 'completed' | 'dnc'
  notes: string | null
  added_at: string
  last_called_at: string | null
  call_count: number | null
  disposition: Disposition
  last_call_log_id: string | null
  scheduled_callback_at: string | null
  lead_status: LeadFollowUpStatus
  clients: { business_name: string } | null
}

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

type Tab = 'queued' | 'called' | 'dnc'

type LeadStatus = Tab | 'calling' | 'completed'

const STATUS_LABEL: Record<LeadStatus, string> = {
  queued: 'Queued',
  called: 'Called',
  calling: 'Dialing…',
  completed: 'Completed',
  dnc: 'DNC',
}

const STATUS_CLS: Record<LeadStatus, string> = {
  queued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  called: 'bg-green-500/10 text-green-400 border-green-500/20',
  calling: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  dnc: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const DISPOSITION_CONFIG: Record<NonNullable<Disposition>, { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
  answered: { label: 'Answered', cls: 'bg-green-500/10 text-green-400 border-green-500/20', Icon: PhoneCall },
  vm: { label: 'Voicemail', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', Icon: Voicemail },
  'no-answer': { label: 'No answer', cls: 'bg-red-500/10 text-red-400 border-red-500/20', Icon: PhoneOff },
}

const LEAD_STATUS_CONFIG: Record<NonNullable<LeadFollowUpStatus>, { label: string; cls: string }> = {
  new:         { label: 'New lead',    cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  called_back: { label: 'Called back', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  booked:      { label: 'Booked ✓',   cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  closed:      { label: 'Closed',      cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const LEAD_STATUS_CYCLE: LeadFollowUpStatus[] = ['new', 'called_back', 'booked', 'closed', null]

function timeAgo(iso: string | null) {
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

function callbackRelativeTime(iso: string): { label: string; overdue: boolean } {
  const diff = new Date(iso).getTime() - Date.now()
  const overdue = diff < 0
  const absMins = Math.floor(Math.abs(diff) / 60000)
  const absHrs = Math.floor(absMins / 60)
  const absDays = Math.floor(absHrs / 24)
  if (overdue) {
    if (absDays > 0) return { label: `${absDays}d overdue`, overdue: true }
    if (absHrs > 0) return { label: `${absHrs}h overdue`, overdue: true }
    return { label: `${absMins}m overdue`, overdue: true }
  }
  if (absDays > 0) return { label: `in ${absDays}d`, overdue: false }
  if (absHrs > 0) return { label: `in ${absHrs}h`, overdue: false }
  if (absMins > 0) return { label: `in ${absMins}m`, overdue: false }
  return { label: 'now', overdue: false }
}

// Format datetime-local value from ISO string
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

interface LeadQueueProps {
  initialLeads: Lead[]
  clients: ClientInfo[]
  hasPhoneNumber?: boolean
}

export default function LeadQueue({ initialLeads, clients, hasPhoneNumber = true }: LeadQueueProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [tab, setTab] = useState<Tab>('queued')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialing, setDialing] = useState<Set<string>>(new Set())
  const [bulkDialing, setBulkDialing] = useState(false)
  const [bulkDialProgress, setBulkDialProgress] = useState<{ current: number; total: number } | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editCallback, setEditCallback] = useState('')
  const [callSummary, setCallSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showScheduledOnly, setShowScheduledOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addPhone, setAddPhone] = useState('')
  const [addName, setAddName] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addClientId, setAddClientId] = useState('')
  const [addError, setAddError] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('lead_queue_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_leads' }, (payload) => {
        const row = payload.new as Lead
        setLeads(prev => {
          if (prev.some(l => l.id === row.id)) return prev
          const client = clients.find(c => c.id === row.client_id)
          return [{ ...row, clients: client ? { business_name: client.business_name } : null }, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_leads' }, (payload) => {
        const row = payload.new as Lead
        setLeads(prev => prev.map(l => l.id === row.id ? { ...l, ...row } : l))
        setDetailLead(prev => prev?.id === row.id ? { ...prev, ...row } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load call summary when detail dialog opens and lead has a last_call_log_id
  useEffect(() => {
    if (!detailLead?.last_call_log_id) { setCallSummary(null); return }
    setLoadingSummary(true)
    fetch(`/api/dashboard/leads/call-summary?call_log_id=${detailLead.last_call_log_id}`)
      .then(r => r.json())
      .then(d => setCallSummary(d.ai_summary ?? null))
      .catch(() => setCallSummary(null))
      .finally(() => setLoadingSummary(false))
  }, [detailLead?.last_call_log_id])

  // D93: for queued tab, split into scheduled (sorted ascending) + unscheduled
  const queuedLeads = leads.filter(l => l.status === 'queued')
  const scheduledLeads = queuedLeads
    .filter(l => l.scheduled_callback_at !== null)
    .sort((a, b) => new Date(a.scheduled_callback_at!).getTime() - new Date(b.scheduled_callback_at!).getTime())
  const unscheduledLeads = queuedLeads.filter(l => l.scheduled_callback_at === null)

  const filtered = leads.filter(l => {
    if (tab === 'queued' && showScheduledOnly) return l.status === 'queued' && l.scheduled_callback_at !== null
    return l.status === tab
  }).sort((a, b) => {
    if (tab === 'queued' && showScheduledOnly && a.scheduled_callback_at && b.scheduled_callback_at) {
      return new Date(a.scheduled_callback_at).getTime() - new Date(b.scheduled_callback_at).getTime()
    }
    return 0
  })
  const allSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id))
  const someSelected = filtered.some(l => selected.has(l.id))
  const selectedCount = filtered.filter(l => selected.has(l.id)).length

  const counts: Record<Tab, number> = {
    queued: leads.filter(l => l.status === 'queued').length,
    called: leads.filter(l => l.status === 'called').length,
    dnc: leads.filter(l => l.status === 'dnc').length,
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(l => s.delete(l.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(l => s.add(l.id)); return s })
    }
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  async function updateStatus(id: string, status: Tab) {
    const res = await fetch('/api/dashboard/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      const { lead } = await res.json()
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...lead } : l))
    }
  }

  async function saveNotes() {
    if (!detailLead) return
    setSavingNotes(true)
    try {
      const res = await fetch('/api/dashboard/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailLead.id,
          notes: editNotes,
          scheduled_callback_at: editCallback ? new Date(editCallback).toISOString() : null,
        }),
      })
      if (res.ok) {
        const { lead } = await res.json()
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...lead } : l))
        setDetailLead(prev => prev ? { ...prev, notes: lead.notes, scheduled_callback_at: lead.scheduled_callback_at } : prev)
        toast.success('Saved')
      }
    } finally {
      setSavingNotes(false)
    }
  }

  async function cycleLeadStatus(lead: Lead) {
    const currentIdx = LEAD_STATUS_CYCLE.indexOf(lead.lead_status)
    const nextStatus = LEAD_STATUS_CYCLE[(currentIdx + 1) % LEAD_STATUS_CYCLE.length]
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, lead_status: nextStatus } : l))
    const res = await fetch('/api/dashboard/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, lead_status: nextStatus }),
    })
    if (!res.ok) {
      // Revert on error
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, lead_status: lead.lead_status } : l))
      toast.error('Failed to update status')
    }
  }

  async function bulkUpdateStatus(status: Tab) {
    const ids = filtered.filter(l => selected.has(l.id)).map(l => l.id)
    await Promise.all(ids.map(id => updateStatus(id, status)))
    setSelected(new Set())
  }

  async function dialLead(lead: Lead) {
    setDialing(prev => new Set(prev).add(lead.id))
    try {
      const res = await fetch('/api/dashboard/leads/dial-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Dial failed' }))
        toast.error(error ?? 'Dial failed')
      } else {
        toast.success('Dialing…')
      }
    } finally {
      setDialing(prev => { const s = new Set(prev); s.delete(lead.id); return s })
    }
  }

  async function bulkDial() {
    const ids = filtered.filter(l => selected.has(l.id)).map(l => l.id)
    if (ids.length === 0) return
    setBulkDialing(true)
    setBulkDialProgress({ current: 0, total: ids.length })
    setSelected(new Set())
    let done = 0
    for (const id of ids) {
      const lead = leads.find(l => l.id === id)
      if (!lead) { done++; continue }
      setBulkDialProgress({ current: done + 1, total: ids.length })
      toast.loading(`Dialing ${lead.name ?? lead.phone} (${done + 1} of ${ids.length})…`, { id: 'bulk-dial' })
      setDialing(prev => new Set(prev).add(id))
      const res = await fetch('/api/dashboard/leads/dial-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }))
        toast.error(`${lead.name ?? lead.phone}: ${error ?? 'Failed'}`)
      }
      setDialing(prev => { const s = new Set(prev); s.delete(id); return s })
      done++
      // Small pause between dials to avoid hammering
      if (done < ids.length) await new Promise(r => setTimeout(r, 1500))
    }
    toast.dismiss('bulk-dial')
    toast.success(`Queued ${ids.length} call${ids.length === 1 ? '' : 's'}`)
    setBulkDialing(false)
    setBulkDialProgress(null)
  }

  async function addLead(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (!addPhone.trim()) { setAddError('Phone is required'); return }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: addPhone.trim(),
          name: addName.trim() || null,
          notes: addNotes.trim() || null,
          client_id: addClientId || null,
        }),
      })
      if (res.ok) {
        const { lead } = await res.json()
        const client = clients.find(c => c.id === lead.client_id)
        setLeads(prev => [{ ...lead, clients: client ? { business_name: client.business_name } : null }, ...prev])
        setAddPhone(''); setAddName(''); setAddNotes(''); setAddClientId('')
        setShowAdd(false)
        setTab('queued')
      } else {
        const { error } = await res.json()
        setAddError(error ?? 'Failed to add contact')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) setAddError('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a contact to the outbound call queue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addLead} className="space-y-3 mt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>Phone *</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={addPhone}
                onChange={e => setAddPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>Name</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                />
              </div>
              {clients.length > 1 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>Assign to</label>
                  <select
                    value={addClientId}
                    onChange={e => setAddClientId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                  >
                    <option value="">— any —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>Notes</label>
              <textarea
                placeholder="Optional — context, source, talking points…"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors resize-none"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
              />
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Adding…' : 'Add Contact'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={open => { if (!open) { setDetailLead(null); setCallSummary(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailLead?.name ?? detailLead?.phone}</DialogTitle>
            <DialogDescription>
              {detailLead?.phone}
              {detailLead?.clients ? ` · ${detailLead.clients.business_name}` : ''}
              {' · Added '}{timeAgo(detailLead?.added_at ?? null)}
              {detailLead?.call_count ? ` · ${detailLead.call_count} call${detailLead.call_count === 1 ? '' : 's'}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-4 text-sm mt-1">
              {/* Status + disposition badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[detailLead.status]}`}>
                  {STATUS_LABEL[detailLead.status]}
                </span>
                {detailLead.disposition && (() => {
                  const d = DISPOSITION_CONFIG[detailLead.disposition]
                  return (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${d.cls}`}>
                      <d.Icon className="h-3 w-3" />
                      {d.label}
                    </span>
                  )
                })()}
                {detailLead.last_called_at && (
                  <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                    Last called {timeAgo(detailLead.last_called_at)}
                  </span>
                )}
              </div>

              {/* Call summary */}
              {detailLead.last_call_log_id && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
                    Last Call Summary
                  </p>
                  {loadingSummary ? (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-3)' }}>
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </div>
                  ) : callSummary ? (
                    <p
                      className="text-[12px] leading-relaxed rounded-lg p-2.5"
                      style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text-2)' }}
                    >
                      {callSummary}
                    </p>
                  ) : (
                    <p className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>No summary available</p>
                  )}
                </div>
              )}

              {/* Scheduled callback */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
                  Scheduled Callback
                </label>
                <input
                  type="datetime-local"
                  value={editCallback}
                  onChange={e => setEditCallback(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                />
                <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>
                  Optional — sets a reminder to follow up at this time.
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add context, talking points, next steps…"
                  className="w-full border rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                />
              </div>

              {/* Move to */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>Move to</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(['queued', 'called', 'dnc'] as Tab[])
                    .filter(s => s !== detailLead.status)
                    .map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(detailLead.id, s)}
                        className="text-[11px] font-semibold px-3 py-1 rounded-lg border transition-all hover:border-blue-500/40"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={!hasPhoneNumber || !!(detailLead && dialing.has(detailLead.id))}
              title={!hasPhoneNumber ? 'Upgrade to a paid plan to get a calling number' : undefined}
              onClick={() => { if (detailLead) { dialLead(detailLead); setDetailLead(null) } }}
            >
              {detailLead && dialing.has(detailLead.id)
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <Phone className="h-4 w-4 mr-1.5" />
              }
              Dial
            </Button>
            <Button onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-1)' }}>Outbound Queue</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            {counts.queued} to call · {counts.called} called · {counts.dnc} DNC
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />Add Contact
        </Button>
      </div>

      {/* Tabs + Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {(['queued', 'called', 'dnc'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(new Set()); if (t !== 'queued') setShowScheduledOnly(false) }}
              className="relative flex-1 px-4 py-3 text-xs font-medium transition-colors"
              style={tab !== t ? { color: 'var(--color-text-3)' } : undefined}
            >
              {tab === t && (
                <motion.div
                  layoutId="lq-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className={tab === t ? 'text-blue-400' : ''}>
                {STATUS_LABEL[t]}
                <span className="ml-1.5 font-mono tabular-nums" style={{ color: 'var(--color-text-3)' }}>
                  {counts[t]}
                </span>
              </span>
            </button>
          ))}
        </div>
        {/* D93: Scheduled sub-filter toggle — only visible on Queued tab */}
        {tab === 'queued' && leads.some(l => l.status === 'queued' && l.scheduled_callback_at !== null) && (
          <div className="flex items-center gap-2 px-4 py-2 border-b text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <button
              onClick={() => setShowScheduledOnly(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${showScheduledOnly ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'border border-transparent hover:text-[var(--color-text-2)]'}`}
              style={showScheduledOnly ? undefined : { color: 'var(--color-text-3)' }}
            >
              <Clock className="h-3 w-3" />
              Scheduled
              <span className="font-mono tabular-nums">
                {leads.filter(l => l.status === 'queued' && l.scheduled_callback_at !== null).length}
              </span>
            </button>
            {showScheduledOnly && (
              <span style={{ color: 'var(--color-text-3)' }}>sorted by time</span>
            )}
          </div>
        )}

        {/* Bulk action bar */}
        {someSelected && (
          <div
            className="flex items-center gap-3 px-4 py-2 border-b text-xs flex-wrap"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-hover)' }}
          >
            <span style={{ color: 'var(--color-text-2)' }}>{selectedCount} selected</span>
            {tab === 'queued' && (
              <button
                onClick={bulkDial}
                disabled={bulkDialing || !hasPhoneNumber}
                title={!hasPhoneNumber ? 'Upgrade to a paid plan to get a calling number' : undefined}
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {bulkDialing
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Dialing {bulkDialProgress?.current}/{bulkDialProgress?.total}…</>
                  : <><Phone className="h-3 w-3" /> Dial selected</>
                }
              </button>
            )}
            {tab !== 'called' && (
              <button
                onClick={() => bulkUpdateStatus('called')}
                className="font-medium text-green-400 hover:text-green-300 transition-colors"
              >
                Mark Called
              </button>
            )}
            {tab !== 'dnc' && (
              <button
                onClick={() => bulkUpdateStatus('dnc')}
                className="font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Mark DNC
              </button>
            )}
            {tab !== 'queued' && (
              <button
                onClick={() => bulkUpdateStatus('queued')}
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Re-queue
              </button>
            )}
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
            <CalendarCheck className="h-8 w-8 opacity-20" />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>
              No {STATUS_LABEL[tab].toLowerCase()} contacts
            </p>
            {tab === 'queued' && (
              <button
                onClick={() => setShowAdd(true)}
                className="text-[12px] font-medium transition-colors"
                style={{ color: 'var(--color-primary)' }}
              >
                Add your first contact
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pr-0">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  {clients.length > 1 && <TableHead>Client</TableHead>}
                  <TableHead>Added</TableHead>
                  {tab === 'called' && <TableHead>Last Called</TableHead>}
                  {tab === 'called' && <TableHead>Disposition</TableHead>}
                  {tab === 'queued' && <TableHead>Callback</TableHead>}
                  <TableHead>SLA</TableHead>
                  <TableHead>Lead Status</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // D93: on queued tab (non-filtered), render scheduled leads first with a divider
                  const renderRow = (lead: Lead) => {
                    const tag = slaTag(lead.added_at)
                    const isChecked = selected.has(lead.id)
                    const disp = lead.disposition ? DISPOSITION_CONFIG[lead.disposition] : null
                    const cbRel = lead.scheduled_callback_at ? callbackRelativeTime(lead.scheduled_callback_at) : null
                    return (
                      <TableRow
                        key={lead.id}
                        className={`transition-colors ${isChecked ? 'bg-blue-500/5' : ''}`}
                      >
                        <TableCell className="w-10 pr-0">
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleRow(lead.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm" style={{ color: 'var(--color-text-1)' }}>
                              {lead.name ?? <span style={{ color: 'var(--color-text-3)' }}>—</span>}
                            </span>
                            {/* D93: relative time badge for scheduled leads */}
                            {cbRel && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                cbRel.overdue
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {cbRel.label}
                              </span>
                            )}
                          </div>
                          {lead.notes && (
                            <p
                              className="text-[11px] mt-0.5 truncate max-w-[180px]"
                              style={{ color: 'var(--color-text-3)' }}
                            >
                              {lead.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[13px]" style={{ color: 'var(--color-text-2)' }}>
                            {lead.phone}
                          </span>
                        </TableCell>
                        {clients.length > 1 && (
                          <TableCell>
                            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                              {lead.clients?.business_name ?? '—'}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                            {timeAgo(lead.added_at)}
                          </span>
                        </TableCell>
                        {tab === 'called' && (
                          <TableCell>
                            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                              {timeAgo(lead.last_called_at)}
                              {lead.call_count && lead.call_count > 1
                                ? <span className="ml-1 opacity-60">×{lead.call_count}</span>
                                : null
                              }
                            </span>
                          </TableCell>
                        )}
                        {tab === 'called' && (
                          <TableCell>
                            {disp ? (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${disp.cls}`}>
                                <disp.Icon className="h-3 w-3" />
                                {disp.label}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-3)' }}>—</span>
                            )}
                          </TableCell>
                        )}
                        {tab === 'queued' && (
                          <TableCell>
                            {lead.scheduled_callback_at ? (
                              <span className="text-[10px] font-mono text-yellow-400">
                                {new Date(lead.scheduled_callback_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-3)' }}>—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {tag ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tag.cls}`}>
                              {tag.label}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-3)' }}>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => cycleLeadStatus(lead)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all hover:opacity-80 whitespace-nowrap ${
                              lead.lead_status
                                ? LEAD_STATUS_CONFIG[lead.lead_status].cls
                                : 'bg-transparent border-dashed text-zinc-500 border-zinc-600 hover:border-zinc-500'
                            }`}
                            title="Click to cycle status"
                          >
                            {lead.lead_status ? LEAD_STATUS_CONFIG[lead.lead_status].label : 'Mark status'}
                          </button>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => dialLead(lead)}
                              disabled={dialing.has(lead.id) || !hasPhoneNumber}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors disabled:opacity-40"
                              title={!hasPhoneNumber ? 'Upgrade to a paid plan to get a calling number' : 'Dial with agent'}
                            >
                              {dialing.has(lead.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Phone className="h-3.5 w-3.5" />
                              }
                            </button>
                            <button
                              onClick={() => {
                                setDetailLead(lead)
                                setEditNotes(lead.notes ?? '')
                                setEditCallback(toDatetimeLocal(lead.scheduled_callback_at))
                              }}
                              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-hover)]"
                              style={{ color: 'var(--color-text-3)' }}
                              title="View / edit"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }

                  const colSpan = 7 + (clients.length > 1 ? 1 : 0) + (tab === 'called' ? 2 : 0) + (tab === 'queued' ? 1 : 0)

                  if (tab === 'queued' && !showScheduledOnly && scheduledLeads.length > 0) {
                    return (
                      <>
                        {scheduledLeads.map(renderRow)}
                        {unscheduledLeads.length > 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={colSpan} className="py-1.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-3)' }}>
                                  Queued
                                </span>
                                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {unscheduledLeads.map(renderRow)}
                      </>
                    )
                  }

                  return filtered.map(renderRow)
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
