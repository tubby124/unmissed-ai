'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from './page'
import { NICHE_CONFIG, getNicheConfig, DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import { parsePromptSections } from '@/lib/prompt-sections'
import { fmtPhone } from '@/lib/settings-utils'
import { getClientSetupState } from '@/lib/client-utils'
import ClientSelector from '@/components/dashboard/ClientSelector'
import type { ClientOption } from '@/components/dashboard/ClientSelector'
import type { VoiceTabVoice, GodConfigEntry, SettingsTab } from '@/components/dashboard/settings/constants'
import { TAB_DEFINITIONS } from '@/components/dashboard/settings/constants'
import { fmtDate } from '@/components/dashboard/settings/shared'
import AgentTab from '@/components/dashboard/settings/AgentTab'
import AgentModeCard from '@/components/dashboard/settings/AgentModeCard'
import ServiceCatalogCard, { type ServiceCatalogItem } from '@/components/dashboard/settings/ServiceCatalogCard'
import SmsTab from '@/components/dashboard/settings/SmsTab'
import VoiceTab from '@/components/dashboard/settings/VoiceTab'
import AlertsTab from '@/components/dashboard/settings/AlertsTab'
import BillingTab from '@/components/dashboard/settings/BillingTab'
import KnowledgeBaseTab from '@/components/dashboard/KnowledgeBaseTab'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface SettingsViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  appUrl: string
  initialClientId?: string
  initialTab?: SettingsTab
}

export default function SettingsView({ clients, isAdmin, appUrl, initialClientId, initialTab }: SettingsViewProps) {
  const { previewMode } = useAdminClient()

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
      monthly_minute_limit: c.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT,
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
    Object.fromEntries(clients.map(c => [c.id, c.booking_service_duration_minutes ?? 30]))
  )
  const [bookingBuffer, setBookingBuffer] = useState<Record<string, number>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.booking_buffer_minutes ?? 0]))
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
  const [voiceStylePreset, setVoiceStylePreset] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.voice_style_preset ?? 'casual_friendly']))
  )
  const [knowledgeEnabled, setKnowledgeEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.knowledge_backend === 'pgvector']))
  )

  // ─── Tab & UI state ──────────────────────────────────────────────────────────
  const validTabs = TAB_DEFINITIONS.filter(t => isAdmin || !t.adminOnly).map(t => t.id)
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (initialTab && validTabs.includes(initialTab)) ? initialTab : (isAdmin ? 'general' : 'billing')
  )
  const [reloadSuccess, setReloadSuccess] = useState<number | null>(null)
  const [knowledgeGapCount, setKnowledgeGapCount] = useState(0)

  // Fetch knowledge gap count for badge
  useEffect(() => {
    if (!selectedId) return
    const params = new URLSearchParams({ client_id: selectedId, days: '30' })
    fetch(`/api/dashboard/knowledge/gaps?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKnowledgeGapCount(d.total ?? 0) })
      .catch(() => {})
  }, [selectedId])

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
  const { patch: patchKnowledge } = usePatchSettings(client?.id ?? '', isAdmin)
  if (!client) return null

  const minutesUsed = client.seconds_used_this_month != null ? Math.ceil(client.seconds_used_this_month / 60) : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Admin — client selector + info strip */}
      {isAdmin && clients.length > 1 && (
        <>
          <ClientSelector
            clients={clients.map((c): ClientOption => ({
              id: c.id,
              slug: c.slug,
              business_name: c.business_name,
              niche: c.niche,
              status: c.status,
              twilio_number: c.twilio_number,
            }))}
            value={selectedId}
            onChange={(id) => {
              setSelectedId(id)
              const c = clients.find(cl => cl.id === id)
              if (c && !prompt[id]) setPrompt(prev => ({ ...prev, [id]: c.system_prompt ?? '' }))
            }}
            hideAllOption
          />

          {/* Selected client info strip */}
          {(() => {
            const setupState = getClientSetupState(client)
            const nc = getNicheConfig(client.niche)
            const statusLabel =
              setupState === 'active' ? 'Active' :
              setupState === 'setup_incomplete' ? 'Setup' :
              setupState === 'unassigned_number' ? 'No number' :
              'Test'
            const statusColor =
              setupState === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
              setupState === 'setup_incomplete' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
              'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'

            return (
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <span className="font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
                  {client.business_name}
                </span>
                <span className={`shrink-0 text-[9px] font-medium border rounded-full px-1.5 py-0.5 leading-none ${statusColor}`}>
                  {statusLabel}
                </span>
                {nc && (
                  <span className={`shrink-0 text-[9px] font-medium ${nc.color} ${nc.bg} ${nc.border} border rounded-full px-1.5 py-0.5 leading-none`}>
                    {nc.label}
                  </span>
                )}
                {client.twilio_number && (
                  <span className="font-mono shrink-0" style={{ color: 'var(--color-text-3)' }}>
                    {fmtPhone(client.twilio_number)}
                  </span>
                )}
                <span className="font-mono shrink-0" style={{ color: 'var(--color-text-3)' }}>
                  {client.slug}
                </span>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b b-theme">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Settings tabs">
          {([
            { id: 'general',       label: 'Agent',    adminOnly: false, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
            { id: 'sms',           label: 'SMS',      adminOnly: true,  icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
            { id: 'voice',         label: 'Voice',    adminOnly: true,  icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2' },
            { id: 'notifications', label: 'Alerts',   adminOnly: true,  icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
            { id: 'billing',       label: 'Billing',  adminOnly: false, icon: 'M2 10h20M22 10V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6Z' },
            { id: 'knowledge',     label: 'Knowledge', adminOnly: true, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z' },
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
              {id === 'knowledge' && knowledgeGapCount > 0 && (
                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                  {knowledgeGapCount}
                </span>
              )}
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

      {/* Preview mode banner */}
      {previewMode && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-4 py-2 text-xs text-amber-400 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Preview mode — all changes are disabled
        </div>
      )}

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
          previewMode={previewMode}
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
          voiceStylePreset={voiceStylePreset}
          setVoiceStylePreset={setVoiceStylePreset}
        />
      )}

      {/* ─── SMS Tab ────────────────────────────────────────────────── */}
      {activeTab === 'sms' && (
        isAdmin ? (
          <SmsTab
            client={client}
            isAdmin={isAdmin}
            previewMode={previewMode}
            smsEnabled={smsEnabled[client.id] ?? false}
            setSmsEnabled={(val) => setSmsEnabled(prev => ({ ...prev, [client.id]: val }))}
            smsTemplate={smsTemplate[client.id] ?? ''}
            setSmsTemplate={(val) => setSmsTemplate(prev => ({ ...prev, [client.id]: val }))}
            agentMode={client.agent_mode}
          />
        ) : (
          <div className="rounded-2xl border b-theme bg-surface px-5 py-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium t1">SMS has moved</p>
            <p className="text-[12px] t3 max-w-xs">Configure SMS follow-up messages and call transfer settings in one place.</p>
            <a href="/dashboard/actions" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors">Go to Actions →</a>
          </div>
        )
      )}

      {/* ─── Voice Tab ──────────────────────────────────────────────── */}
      {activeTab === 'voice' && (
        isAdmin ? (
          <VoiceTab
            client={client}
            voices={voices}
            voicesLoading={voicesLoading}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="rounded-2xl border b-theme bg-surface px-5 py-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium t1">Voice settings have moved</p>
            <p className="text-[12px] t3 max-w-xs">Preview your current voice and browse the Voice Library from your Agent page.</p>
            <a href="/dashboard/agent" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors">Go to Agent →</a>
          </div>
        )
      )}

      {/* ─── Alerts Tab ─────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        isAdmin ? (
          <AlertsTab
            client={client}
            previewMode={previewMode}
            isAdmin={isAdmin}
            tgStyle={tgStyle[client.id] ?? 'standard'}
            setTgStyle={(style) => setTgStyle(prev => ({ ...prev, [client.id]: style }))}
          />
        ) : (
          <div className="rounded-2xl border b-theme bg-surface px-5 py-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium t1">Alerts settings have moved</p>
            <p className="text-[12px] t3 max-w-xs">Configure Telegram notifications, message style, and alert preferences from your Notifications page.</p>
            <a href="/dashboard/notifications" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors">Go to Notifications →</a>
          </div>
        )
      )}

      {/* ─── Billing Tab ────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <BillingTab
          client={client}
          isAdmin={isAdmin}
          previewMode={previewMode}
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
          {isAdmin ? (
            <KnowledgeBaseTab
              clientId={client.id}
              clientSlug={client.slug}
              isAdmin={isAdmin}
              previewMode={previewMode}
              knowledgeEnabled={knowledgeEnabled[client.id] ?? false}
              websiteUrl={client.website_url ?? ''}
              onGapCountChange={setKnowledgeGapCount}
              onToggleEnabled={async (enabled) => {
                if (previewMode) return
                const res = await patchKnowledge({ knowledge_backend: enabled ? 'pgvector' : null })
                if (res.ok) {
                  setKnowledgeEnabled(prev => ({ ...prev, [client.id]: enabled }))
                }
              }}
            />
          ) : (
            <div className="rounded-2xl border b-theme bg-surface px-5 py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-medium t1">Knowledge has moved</p>
              <p className="text-[12px] t3 max-w-xs">Manage what your agent knows — business facts, FAQs, website knowledge, and more.</p>
              <a href="/dashboard/knowledge" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors">Go to Knowledge →</a>
            </div>
          )}
        </motion.div>
      )}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
