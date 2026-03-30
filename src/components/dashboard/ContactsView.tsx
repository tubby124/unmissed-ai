'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Star, Phone, Clock, TrendingUp, X, Plus, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  phone: string
  name: string | null
  call_count: number
  last_call_at: string
  last_status: string | null
  last_summary: string | null
  last_sentiment: string | null
  last_quality_score: number | null
  is_vip: boolean
  vip_relationship: string | null
}

interface CallHistoryRow {
  id: string
  caller_phone: string | null
  caller_name: string | null
  call_status: string | null
  ai_summary: string | null
  started_at: string
  duration_seconds: number | null
  sentiment: string | null
}

interface VipContact {
  id: string
  name: string
  phone: string
  relationship: string | null
  notes: string | null
  transfer_enabled: boolean
}

interface Props {
  clientId: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatDuration(secs: number | null) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

const STATUS_STYLES: Record<string, string> = {
  BOOKED: 'bg-green-500/10 text-green-400',
  LEAD: 'bg-blue-500/10 text-blue-400',
  CALLBACK: 'bg-amber-500/10 text-amber-400',
  VOICEMAIL: 'bg-purple-500/10 text-purple-400',
  EXISTING_CUSTOMER: 'bg-cyan-500/10 text-cyan-400',
  RESOLVED: 'bg-green-500/10 text-green-400',
  UNKNOWN: 'bg-gray-500/10 text-gray-400',
  NOT_INTERESTED: 'bg-red-500/10 text-red-400',
  SPAM: 'bg-red-500/10 text-red-400',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] t3">—</span>
  const cls = STATUS_STYLES[status] ?? 'bg-gray-500/10 text-gray-400'
  const label = status.replace(/_/g, ' ')
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

// ── Call history inside dialog ───────────────────────────────────────────────

function CallHistory({ phone, clientId }: { phone: string; clientId: string }) {
  const [calls, setCalls] = useState<CallHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/dashboard/callers/history?client_id=${clientId}&phone=${encodeURIComponent(phone)}&limit=20`
        )
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setCalls(data.calls ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [phone, clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (calls.length === 0) {
    return <p className="text-[12px] t3 py-4 text-center">No call history found.</p>
  }

  return (
    <div className="space-y-1.5">
      {calls.map(call => (
        <div
          key={call.id}
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-hover)' }}
        >
          <button
            onClick={() => setExpanded(prev => prev === call.id ? null : call.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-hover)] transition-colors"
          >
            <StatusBadge status={call.call_status} />
            <span className="flex-1 text-[11px] t2 truncate">
              {call.ai_summary
                ? call.ai_summary.slice(0, 80) + (call.ai_summary.length > 80 ? '…' : '')
                : 'No summary'}
            </span>
            <span className="text-[10px] t3 shrink-0">{formatDuration(call.duration_seconds)}</span>
            <span className="text-[10px] t3 shrink-0">{formatDate(call.started_at)}</span>
            <ChevronDown
              width={12}
              height={12}
              className={`t3 shrink-0 transition-transform ${expanded === call.id ? 'rotate-180' : ''}`}
            />
          </button>
          {expanded === call.id && call.ai_summary && (
            <div
              className="px-3 pb-3 pt-0"
              style={{ borderTop: '1px solid var(--color-hover)' }}
            >
              <p className="text-[11px] t2 leading-relaxed pt-2">{call.ai_summary}</p>
              {call.sentiment && (
                <p className="mt-1 text-[10px] t3">Sentiment: <span className="t2">{call.sentiment}</span></p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── VIP panel inside dialog ──────────────────────────────────────────────────

function VipPanel({
  contact,
  clientId,
  onVipChange,
}: {
  contact: Contact
  clientId: string
  onVipChange: (isVip: boolean) => void
}) {
  const [vip, setVip] = useState<VipContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [form, setForm] = useState({ name: contact.name ?? '', relationship: '', notes: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!contact.is_vip) { setLoading(false); return }
    fetch(`/api/dashboard/vip-contacts?client_id=${clientId}`)
      .then(r => r.ok ? r.json() : [])
      .then((list: VipContact[]) => {
        const found = list.find(v => v.phone === contact.phone) ?? null
        setVip(found)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [contact.phone, contact.is_vip, clientId])

  async function handleAdd() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/vip-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          name: form.name.trim(),
          phone: contact.phone,
          relationship: form.relationship.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setVip(data)
      onVipChange(true)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove() {
    if (!vip) return
    setRemoving(true)
    try {
      await fetch(`/api/dashboard/vip-contacts?id=${vip.id}&client_id=${clientId}`, { method: 'DELETE' })
      setVip(null)
      onVipChange(false)
    } finally {
      setRemoving(false)
    }
  }

  if (loading) return null

  if (vip) {
    return (
      <div
        className="rounded-xl px-3 py-3 flex items-center justify-between gap-2"
        style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}
      >
        <div>
          <div className="flex items-center gap-1.5">
            <Star width={11} height={11} className="text-amber-400 fill-amber-400" />
            <span className="text-[12px] font-semibold" style={{ color: 'rgb(234,179,8)' }}>VIP Contact</span>
          </div>
          {vip.relationship && (
            <p className="text-[11px] t3 mt-0.5">{vip.relationship}</p>
          )}
          {vip.notes && (
            <p className="text-[11px] t2 mt-0.5">{vip.notes}</p>
          )}
        </div>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-[10px] t3 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
        >
          {removing ? 'Removing…' : 'Remove VIP'}
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl px-3 py-3 space-y-2"
      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[11px] font-semibold t2">Add as VIP contact</p>
      <p className="text-[10px] t3">The agent will greet them by name and prioritize their calls.</p>
      <div className="space-y-1.5">
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Name *"
          className="w-full text-[12px] t1 rounded-lg px-3 py-1.5 outline-none"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        />
        <input
          value={form.relationship}
          onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
          placeholder="Relationship (e.g. Owner's wife)"
          className="w-full text-[12px] t1 rounded-lg px-3 py-1.5 outline-none"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        />
        <input
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Notes (optional)"
          className="w-full text-[12px] t1 rounded-lg px-3 py-1.5 outline-none"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        />
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button
        onClick={handleAdd}
        disabled={adding}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
      >
        <Star width={11} height={11} />
        {adding ? 'Saving…' : 'Save as VIP'}
      </button>
    </div>
  )
}

// ── Contact detail dialog ────────────────────────────────────────────────────

function ContactDialog({
  contact,
  clientId,
  onClose,
  onVipChange,
}: {
  contact: Contact
  clientId: string
  onClose: () => void
  onVipChange: (phone: string, isVip: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {contact.is_vip && <Star width={14} height={14} className="text-amber-400 fill-amber-400 shrink-0" />}
            <span>{contact.name ?? 'Unknown Caller'}</span>
          </DialogTitle>
          <p className="text-[12px] t3 mt-0.5 font-mono">{formatPhone(contact.phone)}</p>
        </DialogHeader>

        {/* Stats strip */}
        <div className="flex items-center gap-4 py-2 border-b b-theme -mx-1">
          <div className="flex items-center gap-1.5">
            <Phone width={11} height={11} className="t3" />
            <span className="text-[11px] t2">{contact.call_count} call{contact.call_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock width={11} height={11} className="t3" />
            <span className="text-[11px] t2">Last: {formatDate(contact.last_call_at)}</span>
          </div>
          {contact.last_sentiment && (
            <div className="flex items-center gap-1.5">
              <TrendingUp width={11} height={11} className="t3" />
              <span className="text-[11px] t2 capitalize">{contact.last_sentiment.toLowerCase()}</span>
            </div>
          )}
          {contact.last_status && (
            <StatusBadge status={contact.last_status} />
          )}
        </div>

        {/* VIP panel */}
        <VipPanel
          contact={contact}
          clientId={clientId}
          onVipChange={isVip => onVipChange(contact.phone, isVip)}
        />

        {/* Call history */}
        <div>
          <p className="text-[11px] font-semibold t1 mb-2">Call History</p>
          <CallHistory phone={contact.phone} clientId={clientId} />
        </div>

        {/* VIP settings link */}
        <div className="pt-1 border-t b-theme">
          {contact.is_vip ? (
            <Link
              href="/dashboard/settings?tab=general#vip"
              className="text-[11px] font-medium text-green-500 hover:text-green-400 transition-colors"
            >
              VIP Contact ✓ — manage in settings
            </Link>
          ) : (
            <Link
              href={`/dashboard/settings?tab=general&vip_phone=${encodeURIComponent(contact.phone)}`}
              className="text-[11px] t3 hover:t2 transition-colors"
            >
              + Add as VIP →
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContactsView({ clientId }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')
  const [filterVip, setFilterVip] = useState(false)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/callers?client_id=${clientId}`)
      if (!res.ok) return
      const data = await res.json()
      setContacts(data.contacts ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  function handleVipChange(phone: string, isVip: boolean) {
    setContacts(prev => prev.map(c =>
      c.phone === phone ? { ...c, is_vip: isVip, vip_relationship: isVip ? c.vip_relationship : null } : c
    ))
    if (selected?.phone === phone) {
      setSelected(prev => prev ? { ...prev, is_vip: isVip } : prev)
    }
  }

  const filtered = contacts.filter(c => {
    if (filterVip && !c.is_vip) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.phone.includes(q) ||
        (c.name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or number…"
            className="w-full text-[12px] t1 rounded-xl pl-3 pr-8 py-2 outline-none"
            style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 t3 hover:t2"
            >
              <X width={12} height={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFilterVip(v => !v)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl transition-colors ${
            filterVip
              ? 'text-amber-400'
              : 't2 hover:t1'
          }`}
          style={{
            backgroundColor: filterVip ? 'rgba(234,179,8,0.1)' : 'var(--color-hover)',
            border: filterVip ? '1px solid rgba(234,179,8,0.3)' : '1px solid var(--color-border)',
          }}
        >
          <Star width={11} height={11} className={filterVip ? 'fill-amber-400' : ''} />
          VIP only
        </button>
        <span className="text-[11px] t3 ml-auto">
          {loading ? '…' : `${filtered.length} of ${total} callers`}
        </span>
      </div>

      {/* Table */}
      <motion.div
        className="rounded-2xl border b-theme bg-surface overflow-hidden"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-1">
            <p className="text-[13px] t2 font-medium">
              {search || filterVip ? 'No contacts match' : 'No callers yet'}
            </p>
            <p className="text-[11px] t3">
              {search || filterVip ? 'Try a different search or filter' : 'Callers will appear here after your first real call'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Calls</TableHead>
                <TableHead>Last Call</TableHead>
                <TableHead>Last Outcome</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(contact => (
                <TableRow key={contact.phone}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {contact.is_vip && (
                        <Star width={10} height={10} className="text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      <span className="font-medium t1">
                        {contact.name ?? <span className="t3 font-normal">Unknown</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] t2">{formatPhone(contact.phone)}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: contact.call_count >= 5
                          ? 'var(--color-primary-10)'
                          : 'var(--color-hover)',
                        color: contact.call_count >= 5 ? 'var(--color-primary)' : 'var(--color-text-2)',
                      }}
                    >
                      {contact.call_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] t2">{formatDate(contact.last_call_at)}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contact.last_status} />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelected(contact)}
                      className="text-[11px] font-semibold hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      View Details
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Detail dialog */}
      {selected && (
        <ContactDialog
          contact={selected}
          clientId={clientId}
          onClose={() => setSelected(null)}
          onVipChange={handleVipChange}
        />
      )}
    </div>
  )
}
