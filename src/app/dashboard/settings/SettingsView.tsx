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
import KnowledgeBaseTab from '@/components/dashboard/KnowledgeBaseTab'
import { useAdminClient } from '@/contexts/AdminClientContext'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import CapabilitiesCard from '@/components/dashboard/CapabilitiesCard'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import PromptEditorModal from '@/components/dashboard/settings/PromptEditorModal'
import { buildCapabilityFlags } from '@/lib/capability-flags'

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
    Object.fromEntries(clients.map(c => [c.id, Array.isArray(c.business_facts) ? c.business_facts.join('\n') : (c.business_facts ?? '')]))
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
  // D55: map legacy/invalid ?tab=agent → general
  const normalizedInitialTab = initialTab === ('agent' as SettingsTab) ? 'general' : initialTab
  // D54: active paid clients default to general, not billing
  const initialClient = clients.find(c => c.id === selectedId) ?? clients[0]
  const defaultTab: SettingsTab = 'general'
  // Non-admin always lands on Agent — SMS/Alerts/Billing/Knowledge live on dedicated pages
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    !isAdmin
      ? defaultTab
      : (normalizedInitialTab && validTabs.includes(normalizedInitialTab)) ? normalizedInitialTab : defaultTab
  )
  const [reloadSuccess, setReloadSuccess] = useState<number | null>(null)
  const [knowledgeGapCount, setKnowledgeGapCount] = useState(0)
  const [showPromptEditor, setShowPromptEditor] = useState(false)

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
    <div className="px-4 sm:px-6 py-6 space-y-5">

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

      {/* ─── Quick Setup Strip (non-admin, non-trial, hides when all done) ─── */}
      {!isAdmin && client.subscription_status !== 'trialing' && (() => {
        const qsItems: Array<{ key: string; label: string; done: boolean; href?: string; tab?: SettingsTab; icon: React.ReactNode }> = [
          {
            key: 'voice',
            label: 'Voice',
            done: !!client.agent_voice_id,
            href: '/dashboard/agent',
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            ),
          },
          {
            key: 'hours',
            label: 'Hours',
            done: !!(client.business_hours_weekday),
            tab: 'general' as const,
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            ),
          },
          {
            key: 'notifications',
            label: 'Alerts',
            done: !!(client.telegram_notifications_enabled || client.email_notifications_enabled),
            href: '/dashboard/notifications',
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            ),
          },
          {
            key: 'knowledge',
            label: 'Knowledge',
            done: !!(client.knowledge_backend === 'pgvector' && (client.approved_knowledge_chunk_count ?? 0) > 0),
            href: '/dashboard/knowledge',
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            ),
          },
        ]
        const doneCount = qsItems.filter(i => i.done).length
        if (doneCount === qsItems.length) return null
        return (
          <div className="rounded-2xl border b-theme bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Quick Setup</p>
              <span className="text-[10px] t3 font-mono">{doneCount}/{qsItems.length} done</span>
            </div>
            <div className="h-1 rounded-full bg-hover mb-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / qsItems.length) * 100}%`, backgroundColor: 'var(--color-primary)', opacity: 0.7 }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {qsItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.href) {
                      window.location.href = item.href
                    } else if (item.tab) {
                      setActiveTab(item.tab)
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer ${
                    item.done
                      ? 'border-green-500/20 bg-green-500/[0.04]'
                      : 'b-theme bg-hover hover:bg-surface'
                  }`}
                >
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full ${item.done ? 'bg-green-500/15' : 'bg-hover border b-theme'}`}>
                    {item.done ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <span className="t3">{item.icon}</span>
                    )}
                  </span>
                  <span className={`text-[9px] font-medium text-center leading-tight ${item.done ? 'text-green-400/80' : 't3'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ─── Overview: Orb + Capabilities + Prompt Editor + Notifications (non-admin) ─── */}
      {!isAdmin && (
        <div className="space-y-4">
          {/* 3-col: Capabilities | Orb | Prompt Editor + Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Left: Capabilities (spans 2) */}
            <div className="md:col-span-2">
              <CapabilitiesCard
                capabilities={buildCapabilityFlags(client)}
                agentName={client.agent_name ?? ''}
                voiceStylePreset={voiceStylePreset[client.id] ?? null}
                isTrial={client.subscription_status === 'trialing'}
                clientId={client.id}
                hasPhoneNumber={!!client.twilio_number}
                hasIvr={!!client.ivr_enabled && !!client.twilio_number}
                hasContextData={!!client.context_data}
                selectedPlan={client.selected_plan}
              />
            </div>

            {/* Right: Orb + Prompt Editor + Notifications */}
            <div className="space-y-4">
              <TestCallCard clientId={client.id} isAdmin={false} />

              <button
                onClick={() => setShowPromptEditor(true)}
                className="w-full text-left card-surface rounded-2xl p-5 hover:border-[var(--color-primary)]/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Advanced</p>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                    POWER USER
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold t1 mb-0.5">Prompt Editor</p>
                    <p className="text-[11px] t3 leading-relaxed">Edit system prompt and all injected context in one place</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 t3 group-hover:text-[var(--color-primary)] transition-colors">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </button>

              <NotificationsWidget
                clientId={client.id}
                isAdmin={isAdmin}
                telegramEnabled={!!(client.telegram_notifications_enabled)}
                emailEnabled={!!(client.email_notifications_enabled)}
                smsEnabled={smsEnabled[client.id] ?? false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab bar (admin only — non-admin SMS/Alerts/Billing/Knowledge live on their own pages) ─── */}
      {isAdmin && (
        <div className="border-b b-theme">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Settings tabs">
            {([
              { id: 'general',       label: 'Agent',    adminOnly: false, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
              { id: 'sms',           label: 'SMS',      adminOnly: false, icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
              { id: 'voice',         label: 'Voice',    adminOnly: true,  icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2' },
              { id: 'notifications', label: 'Alerts',   adminOnly: false, icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
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
      )}

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

      {/* Legacy prompt banner — old-style prompt without section markers */}
      {client?.system_prompt && !client.system_prompt.includes('<!-- unmissed:') && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-xs text-amber-400 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>This agent uses a legacy prompt format. Knowledge base lookups, triage rules, and some settings changes may not take full effect. A prompt migration is needed to enable the full system.</span>
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

      {/* ─── Billing Tab — moved to /dashboard/billing ──────────────── */}
      {activeTab === 'billing' && (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium t1">Billing has moved</p>
          <p className="text-[12px] t3 max-w-xs">Plan details, usage, and invoices are now on their own page.</p>
          <a href="/dashboard/billing" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors">Go to Billing →</a>
        </div>
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

      {/* ─── Prompt Editor Modal ─────────────────────────────────────── */}
      {showPromptEditor && (
        <PromptEditorModal
          clientId={client.id}
          isAdmin={isAdmin}
          systemPrompt={prompt[client.id] ?? ''}
          businessFacts={businessFacts[client.id] ?? ''}
          extraQA={extraQA[client.id] ?? []}
          hoursWeekday={hoursWeekday[client.id] ?? ''}
          hoursWeekend={hoursWeekend[client.id] ?? ''}
          contextData={contextData[client.id] ?? ''}
          onClose={() => setShowPromptEditor(false)}
          onSaved={(updated) => {
            const id = client.id
            setPrompt(prev => ({ ...prev, [id]: updated.system_prompt }))
            setBusinessFacts(prev => ({ ...prev, [id]: updated.business_facts }))
            setExtraQA(prev => ({ ...prev, [id]: updated.extra_qa }))
            setHoursWeekday(prev => ({ ...prev, [id]: updated.business_hours_weekday }))
            setHoursWeekend(prev => ({ ...prev, [id]: updated.business_hours_weekend }))
            setContextData(prev => ({ ...prev, [id]: updated.context_data }))
          }}
        />
      )}
    </div>
  )
}

// ─── Notifications mini widget ────────────────────────────────────────────────
function NotificationsWidget({ clientId, isAdmin, telegramEnabled, emailEnabled, smsEnabled }: {
  clientId: string
  isAdmin: boolean
  telegramEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
}) {
  const { patch, saving } = usePatchSettings(clientId, isAdmin)
  const [tgOn, setTgOn] = useState(telegramEnabled)
  const [emailOn, setEmailOn] = useState(emailEnabled)
  const [smsOn, setSmsOn] = useState(smsEnabled)

  async function toggle(field: string, value: boolean) {
    await patch({ [field]: value })
  }

  const rows = [
    {
      key: 'telegram',
      label: 'Telegram',
      value: tgOn,
      field: 'telegram_notifications_enabled',
      set: setTgOn,
      iconColor: '#2CA5E0',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/>
        </svg>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      value: emailOn,
      field: 'email_notifications_enabled',
      set: setEmailOn,
      iconColor: '#22c55e',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      key: 'sms',
      label: 'SMS follow-up',
      value: smsOn,
      field: 'sms_enabled',
      set: setSmsOn,
      iconColor: '#f59e0b',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="card-surface rounded-2xl p-5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Notifications</p>
      <div className="space-y-2.5">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-3">
            <span style={{ color: row.iconColor }} className="shrink-0">{row.icon}</span>
            <span className="flex-1 text-[12px] t2">{row.label}</span>
            <button
              onClick={async () => {
                const next = !row.value
                row.set(next)
                await toggle(row.field, next)
              }}
              disabled={saving}
              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${row.value ? 'bg-green-500' : 'bg-[var(--color-hover)] border b-theme'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${row.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <a
        href="/dashboard/notifications"
        className="flex items-center justify-between mt-3 pt-3 border-t b-theme text-[11px] font-medium transition-colors"
        style={{ color: 'var(--color-primary)' }}
      >
        All notification settings
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  )
}
