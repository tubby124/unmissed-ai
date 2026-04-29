'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useClientScope } from '@/lib/admin-scope'
import { isAdminRedesignEnabledClient } from '@/lib/feature-flags'

// Phase 1 — Client switcher pill.
// Admin-only UI for selecting which client's data the dashboard surfaces. URL
// is canonical (?client_id=); localStorage holds the last-selected as a resume
// hint. Self-gates on ADMIN_REDESIGN_ENABLED so the bar disappears entirely
// when the redesign is off.
//
// Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 1)

export default function ClientSwitcher() {
  const { isAdmin, scopedClientId, scopedClient, clients, setScope } = useClientScope()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.business_name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.niche ?? '').toLowerCase().includes(q)
    )
  }, [clients, query])

  const onSelect = useCallback((id: string) => {
    setScope(id)
    setQuery('')
    setOpen(false)
  }, [setScope])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Enter' && filtered.length > 0) {
      onSelect(filtered[0].id)
    }
  }, [filtered, onSelect])

  if (!mounted) return null
  if (!isAdminRedesignEnabledClient()) return null
  if (!isAdmin) return null

  const label = scopedClient?.business_name ?? 'All clients'
  const subtitle = scopedClient?.slug ?? `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`

  return (
    <div
      data-testid="admin-client-switcher-bar"
      className="px-4 py-2 border-b flex items-center gap-2"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <span
        className="text-[10px] uppercase tracking-wider font-semibold opacity-60"
        style={{ color: 'var(--color-text-2)' }}
      >
        Acting as
      </span>

      <div ref={containerRef} className="relative inline-block" data-testid="admin-client-switcher">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Switch client (current: ${label})`}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-[var(--color-hover)] transition-colors cursor-pointer"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-page)', color: 'var(--color-text-1)' }}
        >
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
          <span className="font-semibold truncate max-w-[18ch]">{label}</span>
          <span className="text-[10px] opacity-60 truncate max-w-[14ch]">{subtitle}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Client list"
            className="absolute z-50 mt-1 w-72 max-h-80 overflow-hidden rounded-lg border shadow-lg flex flex-col left-0"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Filter by name, slug, niche…"
                className="w-full text-xs px-2 py-1.5 rounded border bg-transparent outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
              />
            </div>
            <ul className="flex-1 overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => onSelect('all')}
                  aria-selected={scopedClientId === 'all'}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[var(--color-hover)] cursor-pointer ${scopedClientId === 'all' ? 'bg-[var(--color-hover)]' : ''}`}
                  style={{ color: 'var(--color-text-1)' }}
                >
                  <span className="font-medium">All clients</span>
                  <span className="text-[10px] opacity-60">{clients.length}</span>
                </button>
              </li>
              {filtered.length === 0 ? (
                <li
                  className="px-3 py-3 text-xs opacity-60"
                  style={{ color: 'var(--color-text-2)' }}
                >
                  No matches
                </li>
              ) : (
                filtered.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      aria-selected={scopedClientId === c.id}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-[var(--color-hover)] cursor-pointer ${scopedClientId === c.id ? 'bg-[var(--color-hover)]' : ''}`}
                      style={{ color: 'var(--color-text-1)' }}
                    >
                      <span className="min-w-0 flex flex-col">
                        <span className="font-medium truncate">{c.business_name}</span>
                        <span className="text-[10px] opacity-60 truncate">
                          {c.slug}{c.niche ? ` · ${c.niche}` : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${
                          c.status === 'active' ? 'bg-green-500'
                          : c.status === 'paused' ? 'bg-amber-500'
                          : 'bg-zinc-400'
                        }`}
                        aria-label={c.status ?? 'unknown status'}
                      />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
