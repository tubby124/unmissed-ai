'use client'

/**
 * HoursSheet — business hours quick edit inside HomeSideSheet.
 */

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin: boolean
  initialWeekday: string
  initialWeekend: string
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function HoursSheet({ clientId, isAdmin, initialWeekday, initialWeekend, markDirty, markClean, onSave }: Props) {
  const [weekday, setWeekday] = useState(initialWeekday)
  const [weekend, setWeekend] = useState(initialWeekend)

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  const isDirty = weekday !== initialWeekday || weekend !== initialWeekend

  async function save() {
    const res = await patch({
      business_hours_weekday: weekday,
      business_hours_weekend: weekend,
    })
    if (res?.ok) markClean()
  }

  return (
    <div className="space-y-5">
      <p className="text-xs t3 leading-relaxed">
        Your agent uses these hours to tell callers when you&apos;re available and to handle after-hours calls.
      </p>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Weekday Hours</label>
        <input
          type="text"
          value={weekday}
          onChange={e => { setWeekday(e.target.value); markDirty() }}
          placeholder="e.g. Mon–Fri 9am–5pm"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm t1 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Weekend Hours</label>
        <input
          type="text"
          value={weekend}
          onChange={e => { setWeekend(e.target.value); markDirty() }}
          placeholder="e.g. Sat 10am–2pm, Sun closed"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm t1 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        />
      </div>

      {(isDirty || saved) && (
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Hours'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <a
        href="/dashboard/agent"
        className="block text-center text-xs font-semibold"
        style={{ color: 'var(--color-text-3)' }}
      >
        Advanced hours & after-hours settings →
      </a>
    </div>
  )
}
