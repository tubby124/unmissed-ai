'use client'

import { useState } from 'react'
import { usePatchSettings, type CardMode } from './usePatchSettings'

interface BookingCardProps {
  clientId: string
  isAdmin: boolean
  calendarAuthStatus: string | null
  googleCalendarId: string | null
  initialDuration: number
  initialBuffer: number
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
}

export default function BookingCard({
  clientId,
  isAdmin,
  calendarAuthStatus,
  googleCalendarId,
  initialDuration,
  initialBuffer,
  previewMode,
  mode = 'settings',
  onSave,
}: BookingCardProps) {
  const [duration, setDuration] = useState(initialDuration)
  const [buffer, setBuffer] = useState(initialBuffer)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  async function save() {
    await patch({
      booking_service_duration_minutes: duration,
      booking_buffer_minutes: buffer,
    })
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400/80">{mode === 'onboarding' ? 'Calendar Booking' : 'Booking'}</p>
        </div>
      </div>
      <p className="text-[11px] t3 mb-4">{mode === 'onboarding' ? 'Let your agent book appointments for you. Connect Google Calendar to get started.' : 'Connect Google Calendar to let your agent check availability and book appointments on live calls.'}</p>

      {/* Connection status */}
      {calendarAuthStatus === 'connected' ? (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-xs text-emerald-300">Calendar connected</span>
          {googleCalendarId && (
            <span className="text-[10px] font-mono t3 truncate">{googleCalendarId}</span>
          )}
        </div>
      ) : calendarAuthStatus === 'expired' ? (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          Calendar authorization expired — reconnect below.
        </div>
      ) : null}

      {/* Connect button */}
      <a
        href={`/api/auth/google${isAdmin ? `?client_id=${clientId}` : ''}`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        {calendarAuthStatus === 'connected' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
      </a>

      {/* Duration + buffer settings (only when connected) */}
      {calendarAuthStatus === 'connected' && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] t3 block mb-1">Appointment duration</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
              >
                {[30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] t3 block mb-1">Buffer between appointments</label>
              <select
                value={buffer}
                onChange={e => setBuffer(Number(e.target.value))}
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
              >
                {[0, 10, 15, 30].map(m => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || previewMode}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
            } disabled:opacity-40`}
          >
            {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save Booking Config'}
          </button>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
