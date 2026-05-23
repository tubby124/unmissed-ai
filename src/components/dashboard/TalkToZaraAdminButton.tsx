'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const BrowserTestCall = dynamic(() => import('@/components/dashboard/BrowserTestCall'), { ssr: false })

export default function TalkToZaraAdminButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinUrl, setJoinUrl] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/zara', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.joinUrl) {
        setError(data.error ?? 'Failed to start admin call')
        setBusy(false)
        return
      }
      setJoinUrl(data.joinUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setBusy(false)
    }
  }

  if (joinUrl) {
    return (
      <div className="rounded-2xl border b-theme overflow-hidden bg-surface">
        <div className="px-4 py-2.5 border-b b-theme bg-surface flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
            Zara — Admin Mode
          </p>
          <button
            onClick={() => { setJoinUrl(null); setBusy(false) }}
            className="text-[10px] font-mono uppercase tracking-widest underline t2 hover:t1"
          >
            End call
          </button>
        </div>
        <div className="p-4">
          <BrowserTestCall joinUrl={joinUrl} onEnd={() => { setJoinUrl(null); setBusy(false) }} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border b-theme overflow-hidden bg-surface">
      <div className="px-4 py-2.5 border-b b-theme bg-surface">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
          Zara — Admin Mode
        </p>
      </div>
      <div className="px-4 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="text-[12px] t1 font-medium">Talk to Zara as Operator</p>
          <p className="text-[11px] t3 mt-1">
            Browser WebRTC with admin tools: adminCallsReport · adminSpendReport · adminClientLookup. Ask her anything about the platform — calls, minutes, spend, specific clients.
          </p>
        </div>
        <button
          onClick={start}
          disabled={busy}
          className="px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-widest disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-cta)', color: 'white' }}
        >
          {busy ? 'Connecting…' : 'Start admin call'}
        </button>
      </div>
      {error && (
        <div className="px-4 py-2 border-t b-theme text-[11px] text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
