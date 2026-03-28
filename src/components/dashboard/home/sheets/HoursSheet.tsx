'use client'

/**
 * HoursSheet — business hours quick edit inside HomeSideSheet.
 */

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

const BEHAVIOR_OPTIONS = [
  { value: 'take_message', label: 'Take a message' },
  { value: 'route_emergency', label: 'Route to emergency number' },
] as const

interface Props {
  clientId: string
  isAdmin: boolean
  initialWeekday: string
  initialWeekend: string
  initialAfterHoursBehavior: string | null
  initialAfterHoursPhone: string | null
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function HoursSheet({
  clientId, isAdmin,
  initialWeekday, initialWeekend,
  initialAfterHoursBehavior, initialAfterHoursPhone,
  markDirty, markClean, onSave,
}: Props) {
  const [weekday, setWeekday] = useState(initialWeekday)
  const [weekend, setWeekend] = useState(initialWeekend)
  const [behavior, setBehavior] = useState(initialAfterHoursBehavior ?? 'take_message')
  const [emergencyPhone, setEmergencyPhone] = useState(initialAfterHoursPhone ?? '')

  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  const hasCustomMessage = initialAfterHoursBehavior === 'custom_message'

  const isDirty =
    weekday !== initialWeekday ||
    weekend !== initialWeekend ||
    behavior !== (initialAfterHoursBehavior ?? 'take_message') ||
    emergencyPhone !== (initialAfterHoursPhone ?? '')

  async function save() {
    const res = await patch({
      business_hours_weekday: weekday,
      business_hours_weekend: weekend,
      after_hours_behavior: behavior,
      after_hours_emergency_phone: emergencyPhone,
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

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">After Hours Behavior</label>
        {hasCustomMessage ? (
          <div
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm"
            style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)' }}
          >
            <span style={{ color: 'var(--color-text-2)' }}>Custom message set</span>
            <a
              href="/dashboard/agent"
              className="text-xs font-semibold hover:opacity-75 transition-opacity"
              style={{ color: 'var(--color-primary)' }}
            >
              Edit in Hours settings →
            </a>
          </div>
        ) : (
          <div className="space-y-1.5">
            {BEHAVIOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setBehavior(opt.value); markDirty() }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-left transition-colors"
                style={{
                  backgroundColor: behavior === opt.value ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-hover)',
                  border: `1px solid ${behavior === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: behavior === opt.value ? 'var(--color-primary)' : 'var(--color-text-1)',
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                  style={{
                    border: `1.5px solid ${behavior === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {behavior === opt.value && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    />
                  )}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {behavior === 'route_emergency' && (
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Emergency Phone Number</label>
          <input
            type="tel"
            value={emergencyPhone}
            onChange={e => { setEmergencyPhone(e.target.value); markDirty() }}
            placeholder="e.g. +1 (555) 000-0000"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm t1 outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-hover)',
              border: '1px solid var(--color-border)',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          />
        </div>
      )}

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
        Advanced hours &amp; after-hours settings →
      </a>
    </div>
  )
}
