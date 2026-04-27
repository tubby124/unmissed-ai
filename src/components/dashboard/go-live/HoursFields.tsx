'use client'

/**
 * HoursFields — Go Live tab Section 2: Hours and after-hours.
 *
 * Spec: docs/superpowers/specs/2026-04-26-go-live-tab-design.md §5.2
 *
 * Three controls bound to PER_CALL_CONTEXT_ONLY DB fields:
 *   - business_hours_weekday        (text)
 *   - business_hours_weekend        (text, optional)
 *   - after_hours_behavior          (radio: take_message | route_emergency | always_open)
 *   - after_hours_emergency_phone   (text, only when behavior=route_emergency)
 *
 * All four are PER_CALL_CONTEXT_ONLY per the mutation contract — DB write
 * only, no Ultravox sync needed (the inbound webhook reads them fresh on
 * every call via buildAgentContext()).
 *
 * Save behavior: 800ms debounce per field with green ✓ chip on success.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

export type AfterHoursBehavior = 'take_message' | 'route_emergency' | 'always_open'

export interface HoursFieldsClient {
  id: string
  business_hours_weekday: string | null
  business_hours_weekend: string | null
  after_hours_behavior: string | null
  after_hours_emergency_phone: string | null
}

interface Props {
  client: HoursFieldsClient
  isAdmin: boolean
  onSave?: () => void
}

const DEBOUNCE_MS = 800

const BEHAVIOR_OPTIONS: { value: AfterHoursBehavior; label: string; helper: string }[] = [
  { value: 'take_message',    label: 'Take a message',           helper: 'Collect their info, follow up later.' },
  { value: 'route_emergency', label: 'Forward to emergency line', helper: 'Transfer urgent calls to a phone number.' },
  { value: 'always_open',     label: 'Same as during hours',     helper: 'Treat after-hours like any other call.' },
]

export default function HoursFields({ client, isAdmin, onSave }: Props) {
  const [weekday, setWeekday] = useState(client.business_hours_weekday ?? '')
  const [weekend, setWeekend] = useState(client.business_hours_weekend ?? '')
  const [behavior, setBehavior] = useState<AfterHoursBehavior>(
    coerceBehavior(client.after_hours_behavior)
  )
  const [emergencyPhone, setEmergencyPhone] = useState(client.after_hours_emergency_phone ?? '')

  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})

  const { patch } = usePatchSettings(client.id, isAdmin, { onSave })

  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(timer => { if (timer) clearTimeout(timer) })
  }, [])

  const scheduleSave = useCallback(
    (fieldKey: string, build: () => Record<string, unknown>, immediate = false) => {
      const existing = timers.current[fieldKey]
      if (existing) clearTimeout(existing)
      const delay = immediate ? 50 : DEBOUNCE_MS
      timers.current[fieldKey] = setTimeout(async () => {
        const res = await patch(build())
        if (res?.ok) {
          setSavedFlash(prev => ({ ...prev, [fieldKey]: true }))
          setTimeout(() => {
            setSavedFlash(prev => {
              if (!prev[fieldKey]) return prev
              const next = { ...prev }
              delete next[fieldKey]
              return next
            })
          }, 2000)
        }
      }, delay)
    },
    [patch]
  )

  function onWeekdayChange(v: string) {
    setWeekday(v)
    scheduleSave('business_hours_weekday', () => ({ business_hours_weekday: v }))
  }
  function onWeekendChange(v: string) {
    setWeekend(v)
    scheduleSave('business_hours_weekend', () => ({ business_hours_weekend: v }))
  }
  function onBehaviorChange(next: AfterHoursBehavior) {
    setBehavior(next)
    scheduleSave('after_hours_behavior', () => ({ after_hours_behavior: next }), true)
  }
  function onEmergencyPhoneChange(v: string) {
    setEmergencyPhone(v)
    scheduleSave('after_hours_emergency_phone', () => ({ after_hours_emergency_phone: v }))
  }

  return (
    <section className="space-y-4" aria-labelledby="go-live-hours-heading">
      <h2 id="go-live-hours-heading" className="sr-only">Hours and after-hours</h2>

      <Field
        id="gl-hours-weekday"
        label="Weekday hours"
        value={weekday}
        onChange={onWeekdayChange}
        placeholder="Mon–Fri 9am–5pm"
        savedFlash={!!savedFlash.business_hours_weekday}
      />

      <Field
        id="gl-hours-weekend"
        label="Weekend hours"
        value={weekend}
        onChange={onWeekendChange}
        placeholder="Closed weekends"
        savedFlash={!!savedFlash.business_hours_weekend}
        helper="Leave blank if closed."
      />

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-zinc-900">When you&apos;re closed, your agent should...</p>
          <SavedChip visible={!!savedFlash.after_hours_behavior} />
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">After-hours behavior</legend>
          {BEHAVIOR_OPTIONS.map(opt => {
            const selected = behavior === opt.value
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                  selected
                    ? 'border-zinc-900 bg-zinc-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="after-hours-behavior"
                  value={opt.value}
                  checked={selected}
                  onChange={() => onBehaviorChange(opt.value)}
                  className="mt-1 h-4 w-4 accent-zinc-900"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-zinc-900">{opt.label}</span>
                  <span className="text-xs text-zinc-500">{opt.helper}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <AnimatePresence initial={false}>
          {behavior === 'route_emergency' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="gl-emergency-phone" className="text-sm font-medium text-zinc-900">
                    Emergency phone number
                  </label>
                  <SavedChip visible={!!savedFlash.after_hours_emergency_phone} />
                </div>
                <input
                  id="gl-emergency-phone"
                  type="tel"
                  inputMode="tel"
                  value={emergencyPhone}
                  onChange={e => onEmergencyPhoneChange(e.target.value)}
                  placeholder="+1 403 555 0101"
                  autoComplete="tel"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
                />
                {!emergencyPhone && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Add a number — without one, urgent after-hours calls won&apos;t be transferred.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function coerceBehavior(raw: string | null): AfterHoursBehavior {
  if (raw === 'route_emergency' || raw === 'always_open') return raw
  return 'take_message'
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  savedFlash: boolean
  helper?: string
}

function Field({ id, label, value, onChange, placeholder, savedFlash, helper }: FieldProps) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-900">{label}</label>
        <SavedChip visible={savedFlash} />
      </div>
      <input
        id={id}
        type="text"
        inputMode="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
      />
      {helper && <p className="text-xs text-zinc-500 mt-1.5">{helper}</p>}
    </div>
  )
}

function SavedChip({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"
          role="status"
          aria-live="polite"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </motion.span>
      )}
    </AnimatePresence>
  )
}
