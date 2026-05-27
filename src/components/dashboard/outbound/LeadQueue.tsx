'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, Search, Upload, RotateCcw } from 'lucide-react'
import CallComposer from './CallComposer'

interface CampaignLead {
  id: string
  client_id: string
  phone: string
  name: string | null
  status: string | null
  notes: string | null
  added_at: string
  last_called_at: string | null
  call_count: number
}

interface Template {
  id: string
  name: string
  tone: string
  goal: string
  opening: string | null
  is_default: boolean
}

interface LeadQueueProps {
  clientId: string | null
  templates: Template[]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  new:       { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'New' },
  called:    { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Called' },
  no_answer: { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', label: 'No Answer' },
  booked:    { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Booked' },
  closed:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Closed' },
}

function parseCity(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/^([^—]+)/)
  return m ? m[1].trim() : ''
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return p
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

export default function LeadQueue({ clientId, templates }: LeadQueueProps) {
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [dialingLead, setDialingLead] = useState<CampaignLead | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadLeads() {
    if (!clientId) return
    setLoading(true)
    const res = await fetch(`/api/dashboard/leads?client_id=${encodeURIComponent(clientId)}`)
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !clientId) return
    setImporting(true)
    setImportMsg('')
    try {
      const raw = JSON.parse(await file.text())
      const arr: Record<string, unknown>[] = Array.isArray(raw) ? raw : []
      const payload = arr
        .filter(l => typeof l.phone === 'string' && l.phone)
        .map(l => ({
          name: typeof l.name === 'string' ? l.name : '',
          phone: l.phone as string,
          notes: [l.city, l.province].filter(Boolean).join(', ') +
            (typeof l.address === 'string' && l.address ? ` — ${l.address}` : ''),
        }))

      const res = await fetch('/api/dashboard/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: payload, client_id: clientId }),
      })
      const data = await res.json()
      setImportMsg(res.ok ? `Imported ${data.imported} leads` : (data.error || 'Import failed'))
      if (res.ok) loadLeads()
    } catch {
      setImportMsg('Invalid JSON file')
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const cities = [...new Set(leads.map(l => parseCity(l.notes)).filter(Boolean))].sort()

  const filtered = leads.filter(l => {
    if (statusFilter !== 'all' && (l.status ?? 'new') !== statusFilter) return false
    if (cityFilter !== 'all' && parseCity(l.notes) !== cityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (l.name ?? '').toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.notes ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const notCalledCount = leads.filter(l => !l.call_count).length

  if (!clientId) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Select a client to view lead queue.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: leads.length, color: 'var(--color-text-1)' },
          { label: 'Not Called', value: notCalledCount, color: '#f59e0b' },
          { label: 'Called', value: leads.length - notCalledCount, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--color-text-3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + import toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--color-text-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, city…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
          />
        </div>
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shrink-0 transition-all hover:scale-[1.02]"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Phone className="h-3.5 w-3.5" />
          + New Lead
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          title="Import leads from JSON file"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-2)' }}
        >
          <Upload className="h-3.5 w-3.5" />
          {importing ? 'Importing…' : 'Import'}
        </button>
        <button
          onClick={loadLeads}
          title="Refresh"
          className="p-2 rounded-xl border transition-colors hover:opacity-70"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <RotateCcw className="h-3.5 w-3.5" style={{ color: 'var(--color-text-3)' }} />
        </button>
      </div>

      {importMsg && (
        <div
          className="text-xs px-3 py-2 rounded-xl"
          style={{
            backgroundColor: importMsg.startsWith('Import') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: importMsg.startsWith('Import') ? '#22c55e' : '#f87171',
          }}
        >
          {importMsg}
        </div>
      )}

      {/* City pills */}
      {cities.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...cities].map(c => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: cityFilter === c ? 'var(--color-primary)' : 'var(--color-surface)',
                color: cityFilter === c ? 'white' : 'var(--color-text-2)',
                border: `1px solid ${cityFilter === c ? 'transparent' : 'var(--color-border)'}`,
              }}
            >
              {c === 'all' ? 'All Cities' : c}
            </button>
          ))}
        </div>
      )}

      {/* Status pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'new', 'called', 'no_answer', 'booked', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: statusFilter === s
                ? (s === 'all' ? 'var(--color-primary)' : STATUS_STYLE[s]?.bg ?? 'var(--color-surface)')
                : 'var(--color-surface)',
              color: statusFilter === s
                ? (s === 'all' ? 'white' : STATUS_STYLE[s]?.color ?? 'var(--color-text-2)')
                : 'var(--color-text-2)',
              border: `1px solid ${statusFilter === s ? 'transparent' : 'var(--color-border)'}`,
            }}
          >
            {s === 'all' ? 'All' : (STATUS_STYLE[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* Lead rows */}
      {loading ? (
        <div className="text-center py-10 text-sm" style={{ color: 'var(--color-text-3)' }}>Loading leads…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Phone className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-text-3)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-1)' }}>
            {leads.length === 0 ? 'No leads yet' : 'No leads match filter'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
            {leads.length === 0
              ? 'Click Import to load a scraped JSON file of prospects.'
              : 'Try clearing the search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(lead => {
            const city = parseCity(lead.notes)
            const callCount = lead.call_count ?? 0
            return (
              <div
                key={lead.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                {/* Call count bubble */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    backgroundColor: callCount > 0 ? 'rgba(34,197,94,0.15)' : 'var(--color-hover)',
                    color: callCount > 0 ? '#22c55e' : 'var(--color-text-3)',
                  }}
                >
                  {callCount}
                </div>

                {/* Name + details */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
                    {lead.name ?? 'Unknown'}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--color-text-3)' }}>
                    <span className="font-mono">{formatPhone(lead.phone)}</span>
                    {city && <span>· {city}</span>}
                    {lead.last_called_at && <span>· {timeAgo(lead.last_called_at)}</span>}
                  </div>
                </div>

                {/* Status chip */}
                {lead.status && lead.status !== 'new' && STATUS_STYLE[lead.status] && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={STATUS_STYLE[lead.status]}
                  >
                    {STATUS_STYLE[lead.status].label}
                  </span>
                )}

                {/* Dial */}
                <button
                  onClick={() => setDialingLead(lead)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Phone className="h-3 w-3" />
                  Dial
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Dial existing lead */}
      {dialingLead && (
        <CallComposer
          clientId={clientId}
          templates={templates}
          existingLead={dialingLead}
          onClose={() => setDialingLead(null)}
          onCallPlaced={() => { setDialingLead(null); loadLeads() }}
        />
      )}

      {/* Manual new lead + dial */}
      {showManual && (
        <CallComposer
          clientId={clientId}
          templates={templates}
          onClose={() => setShowManual(false)}
          onCallPlaced={() => { setShowManual(false); loadLeads() }}
        />
      )}
    </div>
  )
}
