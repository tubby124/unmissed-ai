'use client'

/**
 * FilterStrip — URL-driven filters for the admin notifications page.
 *
 * State lives in URL search params so admins can deep-link a filtered view
 * (e.g. /dashboard/admin/notifications?channel=email&status=bounced&window=7d).
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'

const CHANNELS = ['all', 'email', 'telegram', 'sms', 'system'] as const
const STATUSES = ['all', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'complained', 'delayed'] as const
const WINDOWS  = ['1h', '24h', '7d', '30d', 'all'] as const

interface FilterStripProps {
  channel?: string
  status?: string
  window?: string
  q?: string
}

export default function FilterStrip({
  channel = 'all',
  status = 'all',
  window = '24h',
  q = '',
}: FilterStripProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(q)

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value === '' || value === 'all' || (key === 'window' && value === '24h')) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `?${qs}` : '?')
      })
    },
    [params, router],
  )

  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setParam('q', searchValue.trim())
    },
    [searchValue, setParam],
  )

  return (
    <div
      className="rounded-xl p-3 flex flex-wrap gap-3 items-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {/* Channel */}
      <div className="flex gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider self-center mr-1" style={{ color: 'var(--color-text-3)' }}>Channel</span>
        {CHANNELS.map(c => (
          <button
            key={c}
            onClick={() => setParam('channel', c)}
            className="px-2.5 py-1 rounded-md text-[12px] font-medium"
            style={{
              backgroundColor: channel === c ? 'var(--color-primary)' : 'var(--color-hover)',
              color: channel === c ? '#fff' : 'var(--color-text-2)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider self-center mr-1" style={{ color: 'var(--color-text-3)' }}>Status</span>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setParam('status', s)}
            className="px-2.5 py-1 rounded-md text-[12px] font-medium"
            style={{
              backgroundColor: status === s ? 'var(--color-primary)' : 'var(--color-hover)',
              color: status === s ? '#fff' : 'var(--color-text-2)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Window */}
      <div className="flex gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider self-center mr-1" style={{ color: 'var(--color-text-3)' }}>Window</span>
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setParam('window', w)}
            className="px-2.5 py-1 rounded-md text-[12px] font-medium"
            style={{
              backgroundColor: window === w ? 'var(--color-primary)' : 'var(--color-hover)',
              color: window === w ? '#fff' : 'var(--color-text-2)',
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="flex gap-1 ml-auto">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="search client / recipient / content…"
          className="px-2.5 py-1 rounded-md text-[12px] w-56"
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-1)',
          }}
        />
        <button
          type="submit"
          className="px-2.5 py-1 rounded-md text-[12px] font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          Go
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setSearchValue('')
              setParam('q', '')
            }}
            className="px-2.5 py-1 rounded-md text-[12px] font-medium"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
          >
            Clear
          </button>
        )}
      </form>
    </div>
  )
}
