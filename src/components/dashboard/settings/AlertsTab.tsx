'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { usePatchSettings } from './usePatchSettings'
import { PremiumToggle } from '@/components/ui/bouncy-toggle'

interface AlertsTabProps {
  client: ClientConfig
  previewMode?: boolean
  isAdmin: boolean
  tgStyle: string
  setTgStyle: (style: string) => void
}

export default function AlertsTab({ client, previewMode, isAdmin, tgStyle, setTgStyle }: AlertsTabProps) {
  const { saving, patch } = usePatchSettings(client.id, isAdmin)
  const [weeklyDigest, setWeeklyDigest] = useState(client.weekly_digest_enabled !== false)

  async function toggleWeeklyDigest() {
    const newVal = !weeklyDigest
    setWeeklyDigest(newVal)
    const res = await patch({ weekly_digest_enabled: newVal })
    if (!res?.ok) setWeeklyDigest(!newVal)
  }

  async function saveTelegramStyle(style: string) {
    const prev = tgStyle
    setTgStyle(style)
    const res = await patch({ telegram_style: style })
    if (!res?.ok) setTgStyle(prev)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      className="space-y-4"
    >
    <p className="text-[11px] t3 -mb-1">Choose where alerts go and how they look.</p>

    {/* Telegram connection status card */}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Alert Channels</p>
            <p className="text-[11px] t3">How you receive call notifications from your agent.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
            client.telegram_bot_token && client.telegram_chat_id
              ? 'text-green-400 border-green-500/30 bg-green-500/10'
              : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              client.telegram_bot_token && client.telegram_chat_id ? 'bg-green-500' : 'bg-amber-500'
            }`} />
            {client.telegram_bot_token && client.telegram_chat_id ? 'Telegram Connected' : 'Telegram Not Connected'}
          </span>
        </div>
      </div>

      {/* Active channels */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Telegram — active */}
          <div className={`p-4 rounded-xl border transition-all ${
            client.telegram_bot_token && client.telegram_chat_id
              ? 'border-blue-500/20 bg-blue-500/[0.04]'
              : 'b-theme bg-page'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                client.telegram_bot_token && client.telegram_chat_id
                  ? 'bg-blue-500/15'
                  : 'bg-hover'
              }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={client.telegram_bot_token && client.telegram_chat_id ? 'text-blue-400' : 't3'}>
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold t1">Telegram</p>
                <p className="text-[10px] t3">
                  {client.telegram_bot_token && client.telegram_chat_id ? 'Active' : 'Not configured'}
                </p>
              </div>
            </div>
            <p className="text-[10px] t3 leading-relaxed">Instant call summaries with lead classification and next steps.</p>
          </div>

          {/* Additional channels */}
          <div className="p-4 rounded-xl border b-theme bg-page col-span-full">
            <p className="text-[11px] t3">More alert channels (SMS, email) are in development.</p>
          </div>
        </div>
      </div>
    </div>

    {/* Telegram Message Style — only when connected */}
    {client.telegram_bot_token && client.telegram_chat_id && (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Message Style</p>
            <p className="text-[11px] t3">Choose how call summaries appear in your Telegram chat.</p>
          </div>
          {saving && (
            <span className="text-[10px] t3 animate-pulse flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              Saving...
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'compact', label: 'Compact', desc: 'Status + phone + summary in 2-3 lines', icon: 'M4 6h16M4 12h10' },
            { id: 'standard', label: 'Standard', desc: 'Summary, contact, and next steps separated', icon: 'M4 6h16M4 10h16M4 14h12M4 18h8' },
            { id: 'action_card', label: 'Action Card', desc: 'Structured with date, booking, and action items', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => !previewMode && saveTelegramStyle(opt.id)}
              disabled={previewMode}
              className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer group ${
                tgStyle === opt.id
                  ? 'border-blue-500/40 bg-blue-500/[0.08] shadow-[0_0_12px_rgba(59,130,246,0.06)]'
                  : 'b-theme bg-page hover:bg-hover hover:border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  tgStyle === opt.id ? 'bg-blue-500/15' : 'bg-hover group-hover:bg-[var(--color-border)]'
                }`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={tgStyle === opt.id ? 'text-blue-400' : 't3'}>
                    <path d={opt.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className={`text-xs font-semibold transition-colors ${tgStyle === opt.id ? 'text-blue-400' : 't1'}`}>{opt.label}</p>
              </div>
              <p className="text-[10px] t3 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Notification preferences matrix */}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Notification Preferences</p>
        <p className="text-[11px] t3">Fine-grained control over which events trigger alerts. SMS and Email channels are in development.</p>
      </div>
      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-3 t3 font-medium w-36" />
                {(['Telegram', 'SMS', 'Email'] as const).map(ch => (
                  <th key={ch} className="pb-3 font-medium px-6 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] ${
                      ch === 'Telegram' && client.telegram_bot_token && client.telegram_chat_id
                        ? 'text-blue-400'
                        : 't3'
                    }`}>
                      {ch}
                      {ch !== 'Telegram' && (
                        <span className="text-[8px] font-semibold px-1 py-px rounded bg-hover t3">Soon</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {([
                { event: 'HOT lead', active: true },
                { event: 'Missed call', active: true },
                { event: 'Daily digest', active: false },
              ] as const).map(({ event, active }) => (
                <tr key={event} className="group">
                  <td className="py-3.5 t2 font-medium pr-4">
                    <div className="flex items-center gap-2">
                      {event}
                      {active && client.telegram_bot_token && client.telegram_chat_id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Active" />
                      )}
                    </div>
                  </td>
                  {(['telegram', 'sms', 'email'] as const).map(ch => {
                    const isActive = ch === 'telegram' && active && !!(client.telegram_bot_token && client.telegram_chat_id)
                    return (
                      <td key={ch} className="py-3.5 px-6 text-center">
                        <span
                          aria-label={`${event} via ${ch}: ${isActive ? 'active' : 'not available'}`}
                          className={`w-9 h-5 rounded-full relative inline-flex items-center transition-colors duration-200 ${
                            isActive
                              ? 'bg-blue-500'
                              : 'bg-hover opacity-40'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full bg-white shadow-sm absolute transition-all duration-200 ${
                            isActive ? 'left-[18px]' : 'left-0.5'
                          }`} />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Weekly digest toggle */}
    {client.contact_email && (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Weekly Performance Email</p>
            <p className="text-[11px] t3">
              Receive a weekly summary of calls, leads, and bookings every Sunday at 9 AM.
            </p>
            <p className="text-[10px] t3 mt-1">Sent to {client.contact_email}</p>
          </div>
          <PremiumToggle
            checked={weeklyDigest}
            onChange={() => toggleWeeklyDigest()}
            disabled={saving || previewMode}
          />
        </div>
      </div>
    )}

    </motion.div>
  )
}
