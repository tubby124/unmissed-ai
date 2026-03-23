'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createBrowserClient } from '@/lib/supabase/client'
import DialModal from './DialModal'
import { slaTag } from '@/lib/utils/sla'

interface Lead {
  id: string
  client_id: string | null
  phone: string
  name: string | null
  status: 'queued' | 'called' | 'dnc'
  notes: string | null
  added_at: string
  last_called_at: string | null
  clients: { business_name: string } | null
}

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

type Tab = 'queued' | 'called' | 'dnc'

const STATUS_LABEL: Record<Tab, string> = {
  queued: 'Queued',
  called: 'Called',
  dnc: 'DNC',
}

const STATUS_STYLE: Record<Tab, string> = {
  queued: 'bg-[var(--color-hover)] text-[var(--color-text-2)] border-[var(--color-border)]',
  called: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  dnc: 'bg-red-500/10 text-red-400 border-red-500/20',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}


interface LeadQueueProps {
  initialLeads: Lead[]
  clients: ClientInfo[]
}

export default function LeadQueue({ initialLeads, clients }: LeadQueueProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [tab, setTab] = useState<Tab>('queued')
  const [dialPhone, setDialPhone] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addPhone, setAddPhone] = useState('')
  const [addName, setAddName] = useState('')
  const [addClientId, setAddClientId] = useState('')
  const [addError, setAddError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Realtime: refresh when campaign_leads change
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('lead_queue_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_leads' }, (payload) => {
        const row = payload.new as Lead
        setLeads(prev => {
          if (prev.some(l => l.id === row.id)) return prev
          return [{ ...row, clients: clients.find(c => c.id === row.client_id) ? { business_name: clients.find(c => c.id === row.client_id)!.business_name } : null }, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_leads' }, (payload) => {
        const row = payload.new as Lead
        setLeads(prev => prev.map(l => l.id === row.id ? { ...l, ...row } : l))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = leads.filter(l => l.status === tab)

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
          client_id: addClientId || null,
        }),
      })
      if (res.ok) {
        const { lead } = await res.json()
        setLeads(prev => [{ ...lead, clients: clients.find(c => c.id === lead.client_id) ? { business_name: clients.find(c => c.id === lead.client_id)!.business_name } : null }, ...prev])
        setAddPhone('')
        setAddName('')
        setAddClientId('')
        setShowAdd(false)
        setTab('queued')
      } else {
        const { error } = await res.json()
        setAddError(error ?? 'Failed to add lead')
      }
    })
  }

  const counts: Record<Tab, number> = {
    queued: leads.filter(l => l.status === 'queued').length,
    called: leads.filter(l => l.status === 'called').length,
    dnc: leads.filter(l => l.status === 'dnc').length,
  }

  return (
    <div className="space-y-4">
      {/* Dial modal */}
      {dialPhone && (
        <DialModal
          clients={clients}
          defaultPhone={dialPhone}
          onClose={() => setDialPhone(null)}
          onDialed={() => setDialPhone(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-1)" }}>Lead Queue</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>Outbound call targets — manage and dial from here</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Lead
        </button>
      </div>

      {/* Add lead form */}
      {showAdd && (
        <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-blue-400/70 mb-3">New Lead</p>
          <form onSubmit={addLead} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-3)" }}>Phone *</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={addPhone}
                onChange={e => setAddPhone(e.target.value)}
                className="border rounded-lg px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-44 transition-colors"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-1)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-3)" }}>Name</label>
              <input
                type="text"
                placeholder="Optional"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-36 transition-colors"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-1)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-3)" }}>Client</label>
              <select
                value={addClientId}
                onChange={e => setAddClientId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/40 w-40 transition-colors"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-1)" }}
              >
                <option value="">— none —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-text-1)" }}
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ color: "var(--color-text-3)" }}
            >
              Cancel
            </button>
            {addError && <p className="w-full text-xs text-red-400 mt-1">{addError}</p>}
          </form>
        </div>
      )}

      {/* Tab list */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex border-b" style={{ borderColor: "var(--color-border)" }}>
          {(['queued', 'called', 'dnc'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative flex-1 px-4 py-3 text-xs font-medium transition-colors"
              style={tab !== t ? { color: "var(--color-text-3)" } : undefined}
            >
              {tab === t && (
                <motion.div
                  layoutId="lead-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className={tab === t ? 'text-blue-400' : ''}>
                {STATUS_LABEL[t]}
                <span className="ml-1.5 font-mono" style={{ color: "var(--color-text-3)" }}>{counts[t]}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: "var(--color-text-3)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-30">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm">No {STATUS_LABEL[tab].toLowerCase()} leads</p>
            {tab === 'queued' && (
              <button onClick={() => setShowAdd(true)} className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors duration-200 cursor-pointer">
                Add your first lead
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
          {filtered.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 24 }}
              className={`flex items-center gap-4 px-5 py-3.5 border-b hover:bg-[var(--color-hover)] transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}
              style={{ borderBottomColor: "var(--color-border)" }}
            >
              {/* Status pill */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[lead.status]}`}>
                {STATUS_LABEL[lead.status]}
              </span>
              {/* SLA timer — queued only */}
              {lead.status === 'queued' && (() => {
                const tag = slaTag(lead.added_at)
                if (!tag) return null
                return (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${tag.cls}`}>
                    {tag.label}
                  </span>
                )
              })()}

              {/* Phone + name */}
              <div className="min-w-0 w-44 shrink-0">
                <p className="font-mono text-[13px] font-medium truncate" style={{ color: "var(--color-text-1)" }}>{lead.phone}</p>
                {lead.name && <p className="text-xs truncate" style={{ color: "var(--color-text-3)" }}>{lead.name}</p>}
              </div>

              {/* Client */}
              <span className="text-xs w-32 truncate hidden md:block" style={{ color: "var(--color-text-3)" }}>
                {lead.clients?.business_name ?? '—'}
              </span>

              {/* Added */}
              <span className="text-xs font-mono hidden sm:block flex-1" style={{ color: "var(--color-text-3)" }}>
                {timeAgo(lead.added_at)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {lead.status === 'queued' && (
                  <>
                    <button
                      onClick={() => setDialPhone(lead.phone)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.84 19.79 19.79 0 01.7 1.23a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 6.54a16 16 0 006.29 6.29l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Dial
                    </button>
                    <button
                      onClick={() => updateStatus(lead.id, 'called')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:bg-[var(--color-hover)] transition-all"
                      style={{ color: "var(--color-text-3)", borderColor: "var(--color-border)" }}
                    >
                      Called
                    </button>
                    <button
                      onClick={() => updateStatus(lead.id, 'dnc')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:text-red-400 hover:border-red-500/20 transition-all"
                      style={{ color: "var(--color-text-3)", borderColor: "var(--color-border)" }}
                    >
                      DNC
                    </button>
                  </>
                )}
                {lead.status === 'called' && (
                  <button
                    onClick={() => updateStatus(lead.id, 'queued')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:bg-[var(--color-hover)] transition-all"
                    style={{ color: "var(--color-text-3)", borderColor: "var(--color-border)" }}
                  >
                    Requeue
                  </button>
                )}
                {lead.status === 'dnc' && (
                  <span className="text-[11px] text-red-400/60">Do Not Call</span>
                )}
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
