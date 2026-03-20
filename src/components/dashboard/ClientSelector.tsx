'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { getNicheConfig } from '@/lib/niche-config'
import { getClientSetupState } from '@/lib/client-utils'

export interface ClientOption {
  id: string
  slug: string
  business_name: string
  niche?: string | null
  status?: string | null
  twilio_number?: string | null
}

interface ClientSelectorProps {
  clients: ClientOption[]
  value: string // 'all' or client ID
  onChange: (id: string) => void
  hideAllOption?: boolean
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

export default function ClientSelector({ clients, value, onChange, hideAllOption = false }: ClientSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const urlParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const selected = value === 'all' ? null : clients.find(c => c.id === value) ?? null

  const realClients = useMemo(() => clients.filter(c => !c.slug.startsWith('e2e-test')), [clients])

  const { active, unassigned } = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = realClients.filter(c => {
        if (!q) return true
        return (
          c.business_name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.niche?.toLowerCase().includes(q) ?? false) ||
          (c.twilio_number?.includes(search) ?? false)
        )
      })
    return {
      active: filtered.filter(c => c.twilio_number),
      unassigned: filtered.filter(c => !c.twilio_number),
    }
  }, [realClients, search])

  function select(id: string) {
    onChange(id)
    // Persist selection in URL for cross-page navigation
    const params = new URLSearchParams(urlParams.toString())
    if (id === 'all') {
      params.delete('client_id')
    } else {
      params.set('client_id', id)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:bg-[var(--color-hover)]"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-1)',
        }}
      >
        {/* Status dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            value === 'all'
              ? 'bg-blue-500'
              : selected?.twilio_number
              ? 'bg-emerald-500'
              : 'bg-zinc-500'
          }`}
        />

        <span className="truncate max-w-[180px]">
          {value === 'all' ? `All Clients (${realClients.length})` : selected?.business_name ?? 'Select client'}
        </span>

        {/* Niche badge on trigger when a single client is selected */}
        {selected?.niche && (() => {
          const nc = getNicheConfig(selected.niche)
          if (!nc) return null
          return (
            <span className={`text-[9px] font-medium ${nc.color} ${nc.bg} ${nc.border} border rounded-full px-1.5 py-0.5 leading-none hidden sm:inline`}>
              {nc.label}
            </span>
          )
        })()}

        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-3)' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 left-0 w-[340px] rounded-xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--color-bg-raised)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Search */}
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }} className="shrink-0">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Filter clients..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent w-full text-xs outline-none placeholder:text-[var(--color-text-3)]"
                  style={{ color: 'var(--color-text-1)' }}
                />
              </div>
            </div>

            {/* Options */}
            <div className="max-h-[320px] overflow-y-auto py-1">
              {/* All Clients option */}
              {!hideAllOption && (
                <button
                  onClick={() => select('all')}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                    value === 'all' ? 'bg-blue-500/10' : 'hover:bg-[var(--color-hover)]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span className={`text-xs font-medium ${value === 'all' ? 'text-blue-400' : ''}`} style={value === 'all' ? {} : { color: 'var(--color-text-1)' }}>
                    All Clients
                  </span>
                  <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--color-text-3)' }}>
                    {realClients.length}
                  </span>
                </button>
              )}

              {/* Active section */}
              {active.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                      Active ({active.length})
                    </span>
                  </div>
                  {active.map(c => (
                    <ClientRow key={c.id} client={c} selected={value === c.id} onSelect={select} />
                  ))}
                </>
              )}

              {/* Unassigned section */}
              {unassigned.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-3)' }}>
                      Unassigned ({unassigned.length})
                    </span>
                  </div>
                  {unassigned.map(c => (
                    <ClientRow key={c.id} client={c} selected={value === c.id} onSelect={select} />
                  ))}
                </>
              )}

              {/* No results */}
              {active.length === 0 && unassigned.length === 0 && search && (
                <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-3)' }}>
                  No clients matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ClientRow({ client, selected, onSelect }: { client: ClientOption; selected: boolean; onSelect: (id: string) => void }) {
  const nc = getNicheConfig(client.niche)
  const setupState = getClientSetupState(client)
  const isDimmed = setupState === 'setup_incomplete' || setupState === 'unassigned_number'

  return (
    <button
      onClick={() => onSelect(client.id)}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
        selected ? 'bg-blue-500/10' : 'hover:bg-[var(--color-hover)]'
      } ${isDimmed && !selected ? 'opacity-70' : ''}`}
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${
        setupState === 'active' ? 'bg-emerald-500' :
        setupState === 'setup_incomplete' ? 'bg-amber-500' :
        'bg-zinc-500'
      }`} />

      {/* Name + sublabel */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-xs font-medium truncate block ${selected ? 'text-blue-400' : ''}`}
          style={selected ? {} : { color: 'var(--color-text-1)' }}
        >
          {client.business_name}
        </span>
        {setupState === 'setup_incomplete' && (
          <span className="text-[9px] text-amber-400 block">Setup incomplete</span>
        )}
        {setupState === 'unassigned_number' && (
          <span className="text-[9px] block" style={{ color: 'var(--color-text-3)' }}>No number</span>
        )}
      </div>

      {/* Niche badge */}
      {nc && (
        <span className={`text-[9px] font-medium ${nc.color} ${nc.bg} ${nc.border} border rounded-full px-1.5 py-0.5 leading-none shrink-0`}>
          {nc.label}
        </span>
      )}

      {/* Phone number */}
      {client.twilio_number && (
        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--color-text-3)' }}>
          {formatPhone(client.twilio_number)}
        </span>
      )}
    </button>
  )
}
