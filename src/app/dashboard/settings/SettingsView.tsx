'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from './page'
import { NICHE_CONFIG } from '@/lib/niche-config'
import { parsePromptSections } from '@/lib/prompt-sections'
import { fmtPhone, getPlanName } from '@/lib/settings-utils'
import type { VoiceTabVoice, GodConfigEntry, SettingsTab } from '@/components/dashboard/settings/constants'
import { fmtDate } from '@/components/dashboard/settings/shared'
import AgentTab from '@/components/dashboard/settings/AgentTab'
import SmsTab from '@/components/dashboard/settings/SmsTab'
import VoiceTab from '@/components/dashboard/settings/VoiceTab'
import AlertsTab from '@/components/dashboard/settings/AlertsTab'
import BillingTab from '@/components/dashboard/settings/BillingTab'
import KnowledgeBaseTab from '@/components/dashboard/KnowledgeBaseTab'

interface SettingsViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  appUrl: string
  initialClientId?: string
}

export default function SettingsView({ clients, isAdmin, appUrl, initialClientId }: SettingsViewProps) {
  const [selectedId, setSelectedId] = useState(
    (initialClientId && clients.find(c => c.id === initialClientId))
      ? initialClientId
      : (clients[0]?.id ?? '')
  )

  // ─── Record-based state (shared across tabs) ────────────────────────────────
  const [prompt, setPrompt] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.system_prompt ?? '']))
  )
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.status ?? 'active']))
  )
  const [godConfig, setGodConfig] = useState<Record<string, GodConfigEntry>>(() =>
    Object.fromEntries(clients.map(c => [c.id, {
      telegram_bot_token: '',
      telegram_chat_id: c.telegram_chat_id ?? '',
      timezone: c.timezone ?? 'America/Edmonton',
      twilio_number: c.twilio_number ?? '',
      monthly_minute_limit: c.monthly_minute_limit ?? 500,
    }]))
  )
  const [telegramTest, setTelegramTest] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>(() =>
    Object.fromEntries(clients.map(c => [c.id, 'idle' as const]))
  )
  const [tgStyle, setTgStyle] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.telegram_style ?? 'standard']))
  )
  const [smsEnabled, setSmsEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.sms_enabled ?? false]))
  )
  const [smsTemplate, setSmsTemplate] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.sms_template ?? '']))
  )
  const [hoursWeekday, setHoursWeekday] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.business_hours_weekday ?? 'Monday to Friday, 9am to 5pm']))
  )
  const [hoursWeekend, setHoursWeekend] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.business_hours_weekend ?? '']))
  )
  const [afterHoursBehavior, setAfterHoursBehavior] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.after_hours_behavior ?? 'take_message']))
  )
  const [afterHoursPhone, setAfterHoursPhone] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.after_hours_emergency_phone ?? '']))
  )
  const [sectionContent, setSectionContent] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.system_prompt ? parsePromptSections(c.system_prompt) : {}]))
  )
  const [businessFacts, setBusinessFacts] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.business_facts ?? '']))
  )
  const [extraQA, setExtraQA] = useState<Record<string, { q: string; a: string }[]>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.extra_qa ?? []]))
  )
  const [contextData, setContextData] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data ?? '']))
  )
  const [contextDataLabel, setContextDataLabel] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data_label ?? '']))
  )
  const [bookingDuration, setBookingDuration] = useState<Record<string, number>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.booking_service_duration_minutes ?? 60]))
  )
  const [bookingBuffer, setBookingBuffer] = useState<Record<string, number>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.booking_buffer_minutes ?? 15]))
  )
  const [forwardingNumber, setForwardingNumber] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.forwarding_number ?? '']))
  )
  const [transferConditions, setTransferConditions] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.transfer_conditions ?? '']))
  )
  const [setupComplete, setSetupComplete] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.setup_complete ?? false]))
  )
  const [corpusEnabled, setCorpusEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.corpus_enabled ?? false]))
  )

  // ─── Tab & UI state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [reloadSuccess, setReloadSuccess] = useState<number | null>(null)

  // ─── Voice state (shared with VoiceTab) ──────────────────────────────────────
  const [voices, setVoices] = useState<VoiceTabVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [])

  // ─── Reload URL param ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reloaded = params.get('reloaded')
    if (reloaded) {
      setReloadSuccess(parseInt(reloaded, 10))
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setReloadSuccess(null), 5000)
    }
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────────
  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const minutesUsed = client.seconds_used_this_month != null ? Math.ceil(client.seconds_used_this_month / 60) : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? 500
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Admin — client switcher */}
      {isAdmin && clients.length > 1 && (
        <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b b-theme">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">
              All Clients — {clients.length} agents
            </p>
          </div>
          <div className="py-1">
            {(() => {
              const activeClients = clients.filter(c => c.twilio_number)
              const unassignedClients = clients.filter(c => !c.twilio_number)

              function renderRow(c: ClientConfig) {
                const n = c.niche ?? ''
                const nc = NICHE_CONFIG[n] ?? { label: n || 'General', color: 'text-zinc-400', border: 'border-zinc-500/30', bg: 'bg-zinc-500/10' }
                const isSelected = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id)
                      if (!prompt[c.id]) setPrompt(prev => ({ ...prev, [c.id]: c.system_prompt ?? '' }))
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-blue-500/10' : 'hover:bg-hover'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.twilio_number ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                    <span className={`text-xs font-medium truncate flex-1 min-w-0 ${isSelected ? 'text-blue-400' : 't1'}`}>
                      {c.business_name}
                    </span>
                    {n && (
                      <span className={`text-[9px] font-medium ${nc.color} ${nc.bg} ${nc.border} border rounded-full px-1.5 py-0.5 leading-none shrink-0`}>
                        {nc.label}
                      </span>
                    )}
                    {c.twilio_number && (
                      <span className="text-[10px] font-mono shrink-0 t3">
                        {fmtPhone(c.twilio_number)}
                      </span>
                    )}
                  </button>
                )
              }

              return (
                <>
                  {activeClients.length > 0 && (
                    <>
                      <div className="px-4 pt-3 pb-1.5">
                        <span className="text-[9px] font-semibold tracking-[0.18em] uppercase t3">
                          Active ({activeClients.length})
                        </span>
                      </div>
                      {activeClients.map(renderRow)}
                    </>
                  )}
                  {unassignedClients.length > 0 && (
                    <>
                      <div className="px-4 pt-3 pb-1.5">
                        <span className="text-[9px] font-semibold tracking-[0.18em] uppercase t3">
                          Unassigned ({unassignedClients.length})
                        </span>
                      </div>
                      {unassignedClients.map(renderRow)}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ─── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b b-theme">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Settings tabs">
          {([
            { id: 'general',       label: 'Agent',    adminOnly: false, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
            { id: 'sms',           label: 'SMS',      adminOnly: false, icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
            { id: 'voice',         label: 'Voice',    adminOnly: false, icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2' },
            { id: 'notifications', label: 'Alerts',   adminOnly: false, icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
            { id: 'billing',       label: 'Billing',  adminOnly: false, icon: 'M2 10h20M22 10V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6Z' },
            { id: 'knowledge',     label: 'Knowledge', adminOnly: false, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z' },
          ] as { id: SettingsTab; label: string; adminOnly: boolean; icon: string }[])
            .filter(t => !t.adminOnly || isAdmin)
            .map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                activeTab === id
                  ? 'text-blue-400'
                  : 't3 hover:t1'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={`transition-colors duration-200 ${activeTab === id ? 'text-blue-400' : ''}`}>
                <path d={icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {label}
              {activeTab === id && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Reload success banner */}
      {reloadSuccess && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/25 px-4 py-2 text-xs text-green-400">
          {reloadSuccess} minutes added to your account!
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >

      {/* ─── Agent Tab ──────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <AgentTab
          client={client}
          isAdmin={isAdmin}
          appUrl={appUrl}
          prompt={prompt}
          setPrompt={setPrompt}
          status={status}
          setStatus={setStatus}
          godConfig={godConfig}
          setGodConfig={setGodConfig}
          telegramTest={telegramTest}
          setTelegramTest={setTelegramTest}
          hoursWeekday={hoursWeekday}
          setHoursWeekday={setHoursWeekday}
          hoursWeekend={hoursWeekend}
          setHoursWeekend={setHoursWeekend}
          afterHoursBehavior={afterHoursBehavior}
          setAfterHoursBehavior={setAfterHoursBehavior}
          afterHoursPhone={afterHoursPhone}
          setAfterHoursPhone={setAfterHoursPhone}
          sectionContent={sectionContent}
          setSectionContent={setSectionContent}
          businessFacts={businessFacts}
          setBusinessFacts={setBusinessFacts}
          extraQA={extraQA}
          setExtraQA={setExtraQA}
          contextData={contextData}
          contextDataLabel={contextDataLabel}
          bookingDuration={bookingDuration}
          setBookingDuration={setBookingDuration}
          bookingBuffer={bookingBuffer}
          setBookingBuffer={setBookingBuffer}
          forwardingNumber={forwardingNumber}
          setForwardingNumber={setForwardingNumber}
          transferConditions={transferConditions}
          setTransferConditions={setTransferConditions}
          setupComplete={setupComplete}
          setSetupComplete={setSetupComplete}
        />
      )}

      {/* ─── SMS Tab ────────────────────────────────────────────────── */}
      {activeTab === 'sms' && (
        <SmsTab
          client={client}
          isAdmin={isAdmin}
          smsEnabled={smsEnabled[client.id] ?? false}
          setSmsEnabled={(val) => setSmsEnabled(prev => ({ ...prev, [client.id]: val }))}
          smsTemplate={smsTemplate[client.id] ?? ''}
          setSmsTemplate={(val) => setSmsTemplate(prev => ({ ...prev, [client.id]: val }))}
        />
      )}

      {/* ─── Voice Tab ──────────────────────────────────────────────── */}
      {activeTab === 'voice' && (
        <VoiceTab
          client={client}
          voices={voices}
          voicesLoading={voicesLoading}
        />
      )}

      {/* ─── Alerts Tab ─────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <AlertsTab
          client={client}
          tgStyle={tgStyle[client.id] ?? 'standard'}
          setTgStyle={(style) => setTgStyle(prev => ({ ...prev, [client.id]: style }))}
        />
      )}

      {/* ─── Billing Tab ────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <BillingTab
          client={client}
          isAdmin={isAdmin}
          minutesUsed={minutesUsed}
          minuteLimit={minuteLimit}
          totalAvailable={totalAvailable}
          usagePct={usagePct}
        />
      )}

      {/* ─── Knowledge Tab ──────────────────────────────────────────── */}
      {activeTab === 'knowledge' && (
        <motion.div
          key="knowledge"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <KnowledgeBaseTab
            clientId={client.id}
            isAdmin={isAdmin}
            corpusEnabled={corpusEnabled[client.id] ?? false}
            corpusId={client.corpus_id}
            onToggleEnabled={async (enabled) => {
              const body: Record<string, unknown> = { corpus_enabled: enabled }
              if (isAdmin) body.client_id = client.id
              const res = await fetch('/api/dashboard/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
              if (res.ok) {
                setCorpusEnabled(prev => ({ ...prev, [client.id]: enabled }))
              }
            }}
          />
        </motion.div>
      )}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
