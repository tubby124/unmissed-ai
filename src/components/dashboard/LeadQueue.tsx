'use client'

import { useState, useTransition } from 'react'
import DialModal from './DialModal'

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
  queued: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30',
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
          <h1 className="text-lg font-semibold text-zinc-100">Lead Queue</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Outbound call targets — manage and dial from here</p>
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
              <label className="text-[10px] text-zinc-500">Phone *</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={addPhone}
                onChange={e => setAddPhone(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.10] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-44 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500">Name</label>
              <input
                type="text"
                placeholder="Optional"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.10] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 w-36 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500">Client</label>
              <select
                value={addClientId}
                onChange={e => setAddClientId(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.10] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 w-40 transition-colors"
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
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            {addError && <p className="w-full text-xs text-red-400 mt-1">{addError}</p>}
          </form>
        </div>
      )}

      {/* Tab list */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="flex border-b border-white/[0.06]">
          {(['queued', 'called', 'dnc'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {STATUS_LABEL[t]}
              <span className="ml-1.5 font-mono text-zinc-600">{counts[t]}</span>
            </button>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-zinc-600">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-30">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm">No {STATUS_LABEL[tab].toLowerCase()} leads</p>
            {tab === 'queued' && (
              <button onClick={() => setShowAdd(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Add your first lead
              </button>
            )}
          </div>
        ) : (
          filtered.map((lead, i) => (
            <div
              key={lead.id}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}
            >
              {/* Status pill */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[lead.status]}`}>
                {STATUS_LABEL[lead.status]}
              </span>

              {/* Phone + name */}
              <div className="min-w-0 w-44 shrink-0">
                <p className="font-mono text-[13px] text-zinc-100 font-medium truncate">{lead.phone}</p>
                {lead.name && <p className="text-xs text-zinc-500 truncate">{lead.name}</p>}
              </div>

              {/* Client */}
              <span className="text-xs text-zinc-500 w-32 truncate hidden md:block">
                {lead.clients?.business_name ?? '—'}
              </span>

              {/* Added */}
              <span className="text-xs font-mono text-zinc-600 hidden sm:block flex-1">
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-500 border border-white/[0.07] hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                    >
                      Called
                    </button>
                    <button
                      onClick={() => updateStatus(lead.id, 'dnc')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 border border-white/[0.05] hover:text-red-400 hover:border-red-500/20 transition-all"
                    >
                      DNC
                    </button>
                  </>
                )}
                {lead.status === 'called' && (
                  <button
                    onClick={() => updateStatus(lead.id, 'queued')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 border border-white/[0.05] hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
                  >
                    Requeue
                  </button>
                )}
                {lead.status === 'dnc' && (
                  <span className="text-[11px] text-red-400/60">Do Not Call</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
