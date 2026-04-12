'use client'

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface Props {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

export default function OutboundSchedulingCard({ client, isAdmin, previewMode }: Props) {
  const [enabled, setEnabled] = useState(client.outbound_enabled ?? false)
  const [number, setNumber] = useState(client.outbound_number ?? '')
  const [windowStart, setWindowStart] = useState(client.outbound_time_window_start ?? '09:00')
  const [windowEnd, setWindowEnd] = useState(client.outbound_time_window_end ?? '17:00')
  const [maxAttempts, setMaxAttempts] = useState(client.outbound_max_attempts ?? 3)
  const { saving, saved, patch } = usePatchSettings(client.id, isAdmin)

  async function save() {
    await patch({
      outbound_enabled: enabled,
      outbound_number: number.trim() || null,
      outbound_time_window_start: windowStart || null,
      outbound_time_window_end: windowEnd || null,
      outbound_max_attempts: maxAttempts,
    })
  }

  const callFrom = number.trim() || client.twilio_number || null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Outbound Calling</p>
        {/* Master toggle */}
        <button
          type="button"
          disabled={previewMode}
          onClick={() => setEnabled(v => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            enabled ? 'bg-blue-500' : 'bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className="text-[11px] t3 mb-4">
        {enabled ? 'Outbound calls are enabled.' : 'Enable to allow the agent to place outbound calls to leads.'}
      </p>

      <div className={`space-y-3 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* Caller number */}
        <div>
          <label className="text-xs t2 mb-1.5 block">Call from number</label>
          <input
            type="tel"
            value={number}
            onChange={e => setNumber(e.target.value)}
            placeholder={client.twilio_number ?? '+1 (555) 555-5555'}
            disabled={previewMode}
            className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 disabled:opacity-50"
          />
          <p className="text-[11px] t3 mt-1">
            {callFrom
              ? `Calls will show as ${callFrom}.`
              : 'Defaults to your inbound number if left blank.'}
          </p>
        </div>

        {/* Calling window */}
        <div>
          <label className="text-xs t2 mb-1.5 block">Calling window</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={windowStart}
              onChange={e => setWindowStart(e.target.value)}
              disabled={previewMode}
              className="bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 focus:outline-none focus:border-white/20 disabled:opacity-50"
            />
            <span className="text-xs t3">to</span>
            <input
              type="time"
              value={windowEnd}
              onChange={e => setWindowEnd(e.target.value)}
              disabled={previewMode}
              className="bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 focus:outline-none focus:border-white/20 disabled:opacity-50"
            />
          </div>
          <p className="text-[11px] t3 mt-1">Local time based on your timezone setting. No calls outside this window.</p>
        </div>

        {/* Max attempts */}
        <div>
          <label className="text-xs t2 mb-1.5 block">Max attempts per lead</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                disabled={previewMode}
                onClick={() => setMaxAttempts(n)}
                className={`w-9 h-9 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
                  maxAttempts === n
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-white/10 bg-hover t2 hover:border-white/20'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] t3 mt-1">Agent stops trying after this many unanswered calls.</p>
        </div>

        {!client.twilio_number && (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-amber-400/90">No Twilio number assigned — upgrade to a paid plan to enable outbound calls.</span>
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving || previewMode}
        className={`mt-4 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
          saved
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-blue-500 hover:bg-blue-400 text-white'
        } disabled:opacity-40`}
      >
        {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save Outbound Settings'}
      </button>
    </div>
  )
}
