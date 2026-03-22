'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { usePatchSettings } from './usePatchSettings'

interface HoursCardProps {
  clientId: string
  isAdmin: boolean
  initialWeekday: string
  initialWeekend: string
  initialBehavior: string
  initialPhone: string
  previewMode?: boolean
}

export default function HoursCard({
  clientId,
  isAdmin,
  initialWeekday,
  initialWeekend,
  initialBehavior,
  initialPhone,
  previewMode,
}: HoursCardProps) {
  const [weekday, setWeekday] = useState(initialWeekday)
  const [weekend, setWeekend] = useState(initialWeekend)
  const [behavior, setBehavior] = useState(initialBehavior)
  const [phone, setPhone] = useState(initialPhone)

  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  async function save() {
    await patch({
      business_hours_weekday: weekday,
      business_hours_weekend: weekend,
      after_hours_behavior: behavior,
      after_hours_emergency_phone: phone,
    })
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
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Hours &amp; After-Hours</p>
            <p className="text-[11px] t3 mt-0.5">Configure when your agent treats calls as after-hours</p>
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

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekday hours</p>
            <input
              type="text"
              value={weekday}
              onChange={e => setWeekday(e.target.value)}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Monday to Friday, 9am to 5pm"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekend hours <span className="t3 font-normal">(leave blank if closed)</span></p>
            <input
              type="text"
              value={weekend}
              onChange={e => setWeekend(e.target.value)}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Saturday 10am to 2pm, or leave blank for closed"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">When you&apos;re closed, your agent should&hellip;</p>
            <select
              value={behavior}
              onChange={e => setBehavior(e.target.value)}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="take_message">Take a message</option>
              <option value="route_emergency">Route emergencies to a phone number</option>
              <option value="custom_message">Custom message only</option>
            </select>
          </div>
          {behavior === 'route_emergency' && (
            <div>
              <p className="text-[11px] font-medium t2 mb-1.5">Emergency phone number</p>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                placeholder="e.g. +13065550101"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">Office/visit hours — when customers can come in person. Your agent answers calls 24/7.</p>
        </div>
      </div>
    </motion.div>
  )
}
