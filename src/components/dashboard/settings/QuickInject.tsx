'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'

const INJECT_PILLS = [
  { label: 'Away', text: "I'm currently away and unavailable until further notice. Please take a message." },
  { label: 'Holiday', text: "We're closed for the holiday. Normal business hours resume Monday." },
  { label: 'Promo', text: 'We have a limited-time promotion running — ask me for details!' },
]

interface QuickInjectProps {
  client: ClientConfig
  isAdmin: boolean
}

export default function QuickInject({ client, isAdmin }: QuickInjectProps) {
  const [injectedNote, setInjectedNote] = useState(client.injected_note ?? '')
  // Tracks what's confirmed saved in the DB (separate from textarea draft)
  const [savedNote, setSavedNote] = useState(client.injected_note ?? '')
  const [injectLoading, setInjectLoading] = useState(false)

  const hasUnsavedChanges = injectedNote !== savedNote
  const isActive = savedNote.length > 0

  function patch(body: Record<string, unknown>) {
    const payload = { ...body, ...(isAdmin ? { client_id: client.id } : {}) }
    return fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function handleInject(text: string | null) {
    setInjectLoading(true)
    const res = await patch({ injected_note: text })
    setInjectLoading(false)
    if (res.ok) {
      const confirmed = text ?? ''
      setInjectedNote(confirmed)
      setSavedNote(confirmed)
      if (confirmed) {
        toast.success("Today's Update saved — active on next call")
      } else {
        toast.success("Today's Update cleared")
      }
    } else {
      toast.error('Failed to save — try again')
    }
  }

  return (
    <div className="mb-5 pt-4 border-t b-theme">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Today&apos;s Update</p>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 border border-amber-500/15">Temporary</span>
            {isActive && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-[11px] t3 mt-0.5">Broadcast a live message to every caller today — e.g. &apos;We&apos;re closed this afternoon&apos; or &apos;Ask about our sale&apos;. Clears when you remove it.</p>
        </div>
        {isActive && (
          <button
            onClick={() => handleInject(null)}
            disabled={injectLoading}
            className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg border b-theme t3 hover:t1 transition-all disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      {/* Active note preview */}
      {isActive && !hasUnsavedChanges && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-green-500/[0.04] border border-green-500/20">
          <p className="text-[10px] text-green-400/80 leading-relaxed">
            Agent sees on every call: <span className="font-mono font-medium text-green-300/90">RIGHT NOW: {savedNote.length > 80 ? savedNote.slice(0, 80) + '...' : savedNote}</span>
          </p>
          <p className="text-[9px] t3 mt-0.5">Injected at call time — not in the system prompt. Clear it when done.</p>
        </div>
      )}

      {/* Pre-fill pills */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {INJECT_PILLS.map(p => (
          <button
            key={p.label}
            onClick={() => setInjectedNote(p.text)}
            className="text-[10px] px-2.5 py-1 rounded-full border b-theme t3 hover:t2 transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={injectedNote}
          onChange={e => setInjectedNote(e.target.value.slice(0, 500))}
          placeholder="E.g. I'm away until Monday. Please take a message and I'll call back."
          rows={3}
          maxLength={500}
          className="w-full bg-black/20 border b-theme rounded-xl p-3 text-xs t1 resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed pb-6"
        />
        <span className="absolute bottom-2 right-3 text-[10px] t3 tabular-nums pointer-events-none">
          {injectedNote.length}/500
        </span>
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] t3">
          {hasUnsavedChanges && injectedNote
            ? 'Unsaved — click Save to push live'
            : hasUnsavedChanges && !injectedNote
            ? 'Unsaved — click Save to clear'
            : isActive
            ? 'Active on next call'
            : 'Empty = no override active'}
        </p>
        <button
          onClick={() => handleInject(injectedNote || null)}
          disabled={injectLoading || !hasUnsavedChanges}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 ${
            hasUnsavedChanges
              ? 'bg-blue-500 hover:bg-blue-400 text-white'
              : 'bg-black/20 border b-theme t3'
          }`}
        >
          {injectLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
