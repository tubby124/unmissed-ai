'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface AdminDropdownProps {
  clients: ClientConfig[]
  selectedId: string
  onSelect: (id: string) => void
}

export default function AdminDropdown({ clients, selectedId, onSelect }: AdminDropdownProps) {
  const selected = clients.find(c => c.id === selectedId) ?? clients[0]
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border b-theme bg-surface hover:bg-hover transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium t1 truncate">{selected?.business_name}</span>
          {selected?.niche && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-hover t3 shrink-0">{selected.niche}</span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className={`t3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl border b-theme bg-surface shadow-lg max-h-72 overflow-y-auto">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-hover transition-colors ${c.id === selectedId ? 'bg-hover' : ''}`}
            >
              <span className="text-sm t1 truncate flex-1">{c.business_name}</span>
              {c.niche && <span className="text-[11px] t3 shrink-0">{c.niche}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
