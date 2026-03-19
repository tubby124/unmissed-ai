'use client'

import { useState } from 'react'
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
  const [injectLoading, setInjectLoading] = useState(false)
  const [injectSaved, setInjectSaved] = useState(false)

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
    setInjectSaved(false)
    const res = await patch({ injected_note: text })
    setInjectLoading(false)
    if (res.ok) {
      setInjectedNote(text ?? '')
      setInjectSaved(true)
      setTimeout(() => setInjectSaved(false), 3000)
    }
  }

  return (
    <div className="mb-5 pt-4 border-t b-theme">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Quick inject</p>
          <p className="text-[11px] t3 mt-0.5">Temporarily override agent behaviour — away message, holiday hours, promotions.</p>
        </div>
        {injectedNote && (
          <button
            onClick={() => handleInject(null)}
            disabled={injectLoading}
            className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg border b-theme t3 hover:t1 transition-all disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

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
          {injectedNote && !injectSaved
            ? 'Unsaved — click Inject to push live'
            : injectSaved
            ? ''
            : 'Empty = no override active'}
        </p>
        <button
          onClick={() => handleInject(injectedNote || null)}
          disabled={injectLoading}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 ${
            injectSaved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500 hover:bg-blue-400 text-white'
          }`}
        >
          {injectLoading ? 'Pushing...' : injectSaved ? '✓ Injected' : 'Inject'}
        </button>
      </div>
    </div>
  )
}
