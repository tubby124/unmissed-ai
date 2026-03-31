'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePatchSettings, type CardMode } from './usePatchSettings'
import { useDirtyGuard } from './useDirtyGuard'

// ── D132 — Inline preview of what the agent is told after hours ───────────────
function buildAfterHoursPreview(behavior: string, emergencyPhone: string): string {
  if (behavior === 'route_emergency' && emergencyPhone.trim()) {
    return (
      `OFFICE STATUS: The office is currently closed for in-person visits. ` +
      `If this is an emergency, transfer to ${emergencyPhone.trim()}. ` +
      `Otherwise continue helping the caller normally — collect their info and let them know someone will follow up.`
    )
  }
  if (behavior === 'take_message') {
    return (
      `OFFICE STATUS: The office is currently closed for in-person visits. ` +
      `Continue helping the caller normally — collect their info and let them know someone will follow up.`
    )
  }
  if (behavior === 'route_emergency') {
    return (
      `OFFICE STATUS: The office is currently closed for in-person visits. ` +
      `If this is an emergency, transfer to [emergency number — add one above]. ` +
      `Otherwise continue helping the caller normally — collect their info and let them know someone will follow up.`
    )
  }
  // custom_message or unknown
  return `OFFICE STATUS: The office is currently closed for in-person visits. ${behavior}`
}

interface HoursCardProps {
  clientId: string
  isAdmin: boolean
  initialWeekday: string
  initialWeekend: string
  initialBehavior: string
  initialPhone: string
  previewMode?: boolean
  mode?: CardMode
  onSave?: () => void
}

export default function HoursCard({
  clientId,
  isAdmin,
  initialWeekday,
  initialWeekend,
  initialBehavior,
  initialPhone,
  previewMode,
  mode = 'settings',
  onSave,
}: HoursCardProps) {
  const [weekday, setWeekday] = useState(initialWeekday)
  const [weekend, setWeekend] = useState(initialWeekend)
  const [behavior, setBehavior] = useState(initialBehavior)
  const [phone, setPhone] = useState(initialPhone)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { saving, saved, error, patch, clearError } = usePatchSettings(clientId, isAdmin, { onSave })
  const { markDirty, markClean } = useDirtyGuard('hours-' + clientId)

  async function save() {
    const res = await patch({
      business_hours_weekday: weekday,
      business_hours_weekend: weekend,
      after_hours_behavior: behavior,
      after_hours_emergency_phone: phone,
    })
    if (res?.ok) markClean()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">{mode === 'onboarding' ? 'When Are You Open?' : 'Business Hours'}</p>
            <p className="text-[11px] t3 mt-0.5">{mode === 'onboarding' ? 'Your agent answers every call 24/7 — these hours tell it when your business is actually open' : 'Your agent always answers — these hours shape what it says when you\'re closed.'}</p>
          </div>
          <button
            onClick={save}
            disabled={saving || previewMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              saved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
            } disabled:opacity-40`}
          >
            {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save'}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-red-400 mt-2">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekday hours</p>
            <input
              type="text"
              value={weekday}
              onChange={e => { setWeekday(e.target.value); markDirty() }}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Monday to Friday, 9am to 5pm"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekend hours <span className="t3 font-normal">(leave blank if closed)</span></p>
            <input
              type="text"
              value={weekend}
              onChange={e => { setWeekend(e.target.value); markDirty() }}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Saturday 10am to 2pm, or leave blank for closed"
            />
          </div>
          {mode !== 'onboarding' && (
            <>
              <div>
                <p className="text-[11px] font-medium t2 mb-1.5">When you&apos;re closed, your agent should&hellip;</p>
                <select
                  value={behavior}
                  onChange={e => { setBehavior(e.target.value); markDirty() }}
                  className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                >
                  <option value="take_message">Take a message</option>
                  <option value="route_emergency">Route emergencies to a phone number</option>
                  <option value="custom_message">Custom message only</option>
                </select>
                {behavior === 'route_emergency' && !phone && (
                  <p className="text-amber-400/80 text-xs mt-2 leading-relaxed">
                    Emergency routing requires a phone number — add one below or after-hours calls will fail to route.
                  </p>
                )}
              </div>
              {behavior === 'route_emergency' && (
                <div>
                  <p className="text-[11px] font-medium t2 mb-1.5">Emergency phone number</p>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); markDirty() }}
                    className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                    placeholder="e.g. +13065550101"
                  />
                </div>
              )}

              {/* D132 — After-hours preview */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-hover transition-colors text-left"
                >
                  <span className="text-[11px] font-medium t2">Preview after-hours message</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    className={`shrink-0 transition-transform duration-200 ${previewOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--color-text-3)' }}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {previewOpen && (
                  <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-[10px] t3 mt-2 mb-1.5">Here&apos;s what your agent is told when a caller rings after hours:</p>
                    <blockquote className="rounded-lg px-3 py-2 text-[11px] leading-relaxed t2 italic" style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderLeft: '3px solid var(--color-primary)' }}>
                      {buildAfterHoursPreview(behavior, phone)}
                    </blockquote>
                    <p className="text-[10px] t3 mt-1.5">Your agent always answers calls 24/7 — this context tells it how to handle after-hours callers.</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-1">Your agent picks up every call — these hours control how it responds, not when it answers. To only receive calls at certain times, set up time-based forwarding on your phone carrier.</p>
            </>
          )}
          {mode === 'onboarding' && (
            <p className="text-[11px] t3 mt-1">Your agent answers every call 24/7. These hours let it tell callers when you&apos;re open vs. after-hours.</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
