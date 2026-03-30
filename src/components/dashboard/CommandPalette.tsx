'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface PaletteItem {
  label: string
  href?: string
  action?: string
  group: string
  keywords?: string
}

const NAV_ITEMS: PaletteItem[] = [
  { label: 'Overview', href: '/dashboard', group: 'Navigate', keywords: 'home command center' },
  { label: 'Activity — Calls', href: '/dashboard/calls', group: 'Navigate', keywords: 'calls phone activity' },
  { label: 'Activity — Leads', href: '/dashboard/leads', group: 'Navigate', keywords: 'leads outbound queue' },
  { label: 'Activity — Bookings', href: '/dashboard/bookings', group: 'Navigate', keywords: 'bookings appointments calendar' },
  { label: 'Knowledge Base', href: '/dashboard/knowledge', group: 'Navigate', keywords: 'knowledge faq facts' },
  { label: 'Settings', href: '/dashboard/settings', group: 'Navigate', keywords: 'settings configure general' },
  { label: 'Notifications', href: '/dashboard/notifications', group: 'Navigate', keywords: 'notifications alerts telegram' },
  { label: 'Go Live Setup', href: '/dashboard/setup', group: 'Navigate', keywords: 'setup forwarding live' },
  { label: 'Advisor', href: '/dashboard/advisor', group: 'Navigate', keywords: 'advisor ai chat' },
]

const ACTION_ITEMS: PaletteItem[] = [
  { label: 'Sign out', action: 'signOut', group: 'Account', keywords: 'logout sign out' },
]

function matchesQuery(item: PaletteItem, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    item.label.toLowerCase().includes(q) ||
    (item.keywords?.toLowerCase().includes(q) ?? false) ||
    item.group.toLowerCase().includes(q)
  )
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const router = useRouter()
  const supabase = createBrowserClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = [...NAV_ITEMS, ...ACTION_ITEMS]
  const filtered = allItems.filter(item => matchesQuery(item, query))

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Keep activeIdx in bounds
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  async function runItem(item: PaletteItem) {
    onClose()
    if (item.href) {
      router.push(item.href)
    } else if (item.action === 'signOut') {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) runItem(filtered[activeIdx])
    }
  }

  // Group items for display
  const groups = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  let globalIdx = 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent
        className="p-0 gap-0 max-w-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 border-b"
          style={{ borderColor: 'var(--color-border)', height: '52px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-1)' }}
          />
          <button
            onClick={onClose}
            className="text-[11px] px-1.5 py-0.5 rounded border transition-colors hover:bg-hover"
            style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)' }}
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm py-6" style={{ color: 'var(--color-text-3)' }}>
              No results for &quot;{query}&quot;
            </p>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p
                className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-text-3)' }}
              >
                {group}
              </p>
              {items.map(item => {
                const idx = globalIdx++
                const isActive = idx === activeIdx
                return (
                  <button
                    key={item.label}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => runItem(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--color-accent-tint)' : 'transparent',
                      color: isActive ? 'var(--color-cta)' : 'var(--color-text-1)',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-t text-[10px]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
