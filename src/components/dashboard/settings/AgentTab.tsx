'use client'

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import ShimmerButton from '@/components/ui/shimmer-button'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import { NICHE_CONFIG } from '@/lib/niche-config'
import { hasCapability } from '@/lib/niche-capabilities'
import CapabilitiesCard from '@/components/dashboard/settings/CapabilitiesCard'
import RuntimeCard from '@/components/dashboard/settings/RuntimeCard'
import KnowledgeEngineCard from '@/components/dashboard/settings/KnowledgeEngineCard'
import HoursCard from '@/components/dashboard/settings/HoursCard'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicemailGreetingCard from '@/components/dashboard/settings/VoicemailGreetingCard'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import SectionEditorCard from '@/components/dashboard/settings/SectionEditorCard'
import WebhooksCard from '@/components/dashboard/settings/WebhooksCard'
import AgentConfigCard from '@/components/dashboard/settings/AgentConfigCard'
import BookingCard from '@/components/dashboard/settings/BookingCard'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import { fmtPhone } from '@/lib/settings-utils'
import { parsePromptSections } from '@/lib/prompt-sections'
import type { PromptVersion, ImproveResult, LearningStatus, GodConfigEntry } from './constants'
import { TIMEZONES } from './constants'
import { fmtDate, CopyButton } from './shared'

interface AgentTabProps {
  client: ClientConfig
  isAdmin: boolean
  appUrl: string
  prompt: Record<string, string>
  setPrompt: Dispatch<SetStateAction<Record<string, string>>>
  status: Record<string, string>
  setStatus: Dispatch<SetStateAction<Record<string, string>>>
  godConfig: Record<string, GodConfigEntry>
  setGodConfig: Dispatch<SetStateAction<Record<string, GodConfigEntry>>>
  telegramTest: Record<string, 'idle' | 'testing' | 'ok' | 'fail'>
  setTelegramTest: Dispatch<SetStateAction<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>>
  hoursWeekday: Record<string, string>
  setHoursWeekday: Dispatch<SetStateAction<Record<string, string>>>
  hoursWeekend: Record<string, string>
  setHoursWeekend: Dispatch<SetStateAction<Record<string, string>>>
  afterHoursBehavior: Record<string, string>
  setAfterHoursBehavior: Dispatch<SetStateAction<Record<string, string>>>
  afterHoursPhone: Record<string, string>
  setAfterHoursPhone: Dispatch<SetStateAction<Record<string, string>>>
  sectionContent: Record<string, Record<string, string>>
  setSectionContent: Dispatch<SetStateAction<Record<string, Record<string, string>>>>
  businessFacts: Record<string, string>
  setBusinessFacts: Dispatch<SetStateAction<Record<string, string>>>
  extraQA: Record<string, { q: string; a: string }[]>
  setExtraQA: Dispatch<SetStateAction<Record<string, { q: string; a: string }[]>>>
  contextData: Record<string, string>
  contextDataLabel: Record<string, string>
  bookingDuration: Record<string, number>
  setBookingDuration: Dispatch<SetStateAction<Record<string, number>>>
  bookingBuffer: Record<string, number>
  setBookingBuffer: Dispatch<SetStateAction<Record<string, number>>>
  forwardingNumber: Record<string, string>
  setForwardingNumber: Dispatch<SetStateAction<Record<string, string>>>
  transferConditions: Record<string, string>
  setTransferConditions: Dispatch<SetStateAction<Record<string, string>>>
  setupComplete: Record<string, boolean>
  setSetupComplete: Dispatch<SetStateAction<Record<string, boolean>>>
  voiceStylePreset: Record<string, string>
  setVoiceStylePreset: Dispatch<SetStateAction<Record<string, string>>>
  previewMode?: boolean
}

export default function AgentTab({
  client,
  isAdmin,
  appUrl,
  prompt,
  setPrompt,
  status,
  setStatus,
  godConfig,
  setGodConfig,
  telegramTest,
  setTelegramTest,
  hoursWeekday,
  setHoursWeekday,
  hoursWeekend,
  setHoursWeekend,
  afterHoursBehavior,
  setAfterHoursBehavior,
  afterHoursPhone,
  setAfterHoursPhone,
  sectionContent,
  setSectionContent,
  businessFacts,
  setBusinessFacts,
  extraQA,
  setExtraQA,
  contextData,
  contextDataLabel,
  bookingDuration,
  setBookingDuration,
  bookingBuffer,
  setBookingBuffer,
  forwardingNumber,
  setForwardingNumber,
  transferConditions,
  setTransferConditions,
  setupComplete,
  setSetupComplete,
  voiceStylePreset,
  setVoiceStylePreset,
  previewMode,
}: AgentTabProps) {
  // ─── Transient internal state ──────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveUltravoxWarning, setSaveUltravoxWarning] = useState<string | null>(null)
  const [savePromptWarnings, setSavePromptWarnings] = useState<{ field: string; message: string }[]>([])
  const [changeDesc, setChangeDesc] = useState('')

  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'done' | 'partial' | 'error' | 'cooldown'>('idle')
  const [regenCooldownEnd, setRegenCooldownEnd] = useState(0)
  const [regenCooldownLeft, setRegenCooldownLeft] = useState(0)

  // S7c: Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (regenCooldownEnd <= Date.now()) { setRegenCooldownLeft(0); return }
    const tick = () => {
      const left = Math.ceil((regenCooldownEnd - Date.now()) / 1000)
      if (left <= 0) { setRegenCooldownLeft(0); setRegenState('idle'); return }
      setRegenCooldownLeft(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [regenCooldownEnd])

  const [improveState, setImproveState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null)
  const [improveError, setImproveError] = useState('')

  const [learning, setLearning] = useState<LearningStatus | null>(null)
  const [learningState, setLearningState] = useState<'checking' | 'analyzing' | 'ready' | 'idle'>('checking')
  const [learningDismissed, setLearningDismissed] = useState(() => {
    try { return sessionStorage.getItem(`learning_dismissed_${client.id}`) === '1' } catch { return false }
  })
  const dismissLearning = useCallback(() => {
    try { sessionStorage.setItem(`learning_dismissed_${client.id}`, '1') } catch { /* ignore */ }
    setLearningDismissed(true)
  }, [client.id])

  // S7c: Shared regen handler with 429 cooldown support
  const handleRegen = useCallback(async () => {
    setRegenState('loading')
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      if (res.status === 429) {
        const json = await res.json().catch(() => ({}))
        const cooldown = json.cooldown_seconds ?? 300
        setRegenCooldownEnd(Date.now() + cooldown * 1000)
        setRegenState('cooldown')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      if (json.synced === false) {
        setRegenState('partial')
        setTimeout(() => setRegenState('idle'), 4000)
      } else {
        setRegenState('done')
        setTimeout(() => setRegenState('idle'), 3000)
      }
    } catch (e) {
      console.error('[regen]', e)
      setRegenState('error')
      setTimeout(() => setRegenState('idle'), 3000)
    }
  }, [client.id])

  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null)
  const [showAllVersions, setShowAllVersions] = useState(false)

  const [godSaving, setGodSaving] = useState(false)
  const [godSaved, setGodSaved] = useState(false)

  const [promptCollapsed, setPromptCollapsed] = useState(isAdmin)

  const [setupCollapsed, setSetupCollapsed] = useState(() => !!(client.setup_complete || client.twilio_number))
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupSaved, setSetupSaved] = useState(false)
  const [setupEditing, setSetupEditing] = useState(false)

  // ─── Derived values ────────────────────────────────────────────────────────
  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const currentPrompt = prompt[client.id] ?? ''
  const originalPrompt = client.system_prompt ?? ''
  const dirty = currentPrompt !== originalPrompt
  const charCount = currentPrompt.length
  const isActive = status[client.id] === 'active'

  // ─── Handler functions ─────────────────────────────────────────────────────

  async function handleMarkSetupComplete() {
    const body: Record<string, unknown> = { setup_complete: true }
    if (isAdmin) body.client_id = client.id
    await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSetupComplete(prev => ({ ...prev, [client.id]: true }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    setSaveUltravoxWarning(null)
    setSavePromptWarnings([])
    const desc = changeDesc.trim() || 'Edited via dashboard'
    const body: Record<string, unknown> = { system_prompt: currentPrompt, change_description: desc }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      setSaved(true)
      setChangeDesc('')
      setTimeout(() => setSaved(false), 3000)
      if (!data.ultravox_synced && data.ultravox_error) {
        setSaveUltravoxWarning(`Ultravox sync failed: ${data.ultravox_error}. Use "Re-sync Agent" to retry.`)
      }
      if (data.warnings?.length) {
        setSavePromptWarnings(data.warnings)
      }
    } else {
      const d = await res.json().catch(() => ({}))
      setSaveError(d.error || 'Save failed — try again.')
      setTimeout(() => setSaveError(''), 5000)
    }
  }

  async function toggleStatus() {
    const next = status[client.id] === 'active' ? 'paused' : 'active'
    if (next === 'paused') {
      if (!confirm(`Pause ${client.business_name}? Calls will not be answered until you reactivate.`)) return
    }
    setStatus(prev => ({ ...prev, [client.id]: next }))
    const body: Record<string, unknown> = { status: next }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      setStatus(prev => ({ ...prev, [client.id]: next === 'active' ? 'paused' : 'active' }))
      alert('Status update failed — try again.')
    }
  }

  async function testTelegram() {
    setTelegramTest(prev => ({ ...prev, [client.id]: 'testing' }))
    const res = await fetch('/api/dashboard/settings/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id }),
    })
    const data = await res.json().catch(() => ({ ok: false }))
    setTelegramTest(prev => ({ ...prev, [client.id]: data.ok ? 'ok' : 'fail' }))
    setTimeout(() => setTelegramTest(prev => ({ ...prev, [client.id]: 'idle' })), 3000)
  }

  async function saveGodConfig() {
    const cfg = godConfig[client.id]
    if (!cfg) return
    setGodSaving(true)
    setGodSaved(false)
    const body: Record<string, unknown> = { client_id: client.id }
    if (cfg.telegram_bot_token) body.telegram_bot_token = cfg.telegram_bot_token
    if (cfg.telegram_chat_id) body.telegram_chat_id = cfg.telegram_chat_id
    if (cfg.timezone) body.timezone = cfg.timezone
    if (cfg.twilio_number) body.twilio_number = cfg.twilio_number
    if (cfg.monthly_minute_limit) body.monthly_minute_limit = cfg.monthly_minute_limit
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setGodSaved(true)
      // Clear token field after save
      setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], telegram_bot_token: '' } }))
      setTimeout(() => setGodSaved(false), 3000)
    }
    setGodSaving(false)
  }

  async function generateImprovement() {
    setImproveState('loading')
    setImproveError('')
    setImproveResult(null)
    const body: Record<string, unknown> = {}
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/settings/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setImproveError(data.error || 'Something went wrong. Try again.')
        setImproveState('error')
        return
      }
      setImproveResult(data)
      setImproveState('done')
    } catch {
      setImproveError('Network error. Try again.')
      setImproveState('error')
    }
  }

  function applyImprovedPrompt() {
    if (!improveResult) return
    setPrompt(prev => ({ ...prev, [client.id]: improveResult.improved_prompt }))
    setImproveResult(null)
    setImproveState('idle')
  }

  // Learning loop: check on mount + when client changes
  useEffect(() => {
    let cancelled = false
    setLearning(null)
    setLearningState('checking')
    try { setLearningDismissed(sessionStorage.getItem(`learning_dismissed_${client.id}`) === '1') } catch { setLearningDismissed(false) }

    async function checkLearning() {
      const params = isAdmin ? `?client_id=${client.id}` : ''
      const res = await fetch(`/api/dashboard/settings/learning-status${params}`)
      if (!res.ok || cancelled) return
      const data: LearningStatus = await res.json()
      if (cancelled) return
      setLearning(data)

      if (data.should_analyze) {
        setLearningState('analyzing')
        try {
          const body: Record<string, unknown> = {}
          if (isAdmin) body.client_id = client.id
          await fetch('/api/dashboard/analyze-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        } catch { /* silent — non-critical */ }
        if (cancelled) return
        // Re-fetch to get the new pending report
        const res2 = await fetch(`/api/dashboard/settings/learning-status${params}`)
        if (!res2.ok || cancelled) { setLearningState('idle'); return }
        const data2: LearningStatus = await res2.json()
        if (cancelled) return
        setLearning(data2)
        setLearningState(data2.pending_report ? 'ready' : 'idle')
      } else if (data.pending_report) {
        setLearningState('ready')
      } else {
        setLearningState('idle')
      }
    }

    checkLearning().catch(() => setLearningState('idle'))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true)
    const params = isAdmin ? `?client_id=${client.id}` : ''
    const res = await fetch(`/api/dashboard/settings/prompt-versions${params}`)
    if (res.ok) {
      const data = await res.json()
      setVersions(data.versions || [])
    }
    setVersionsLoading(false)
  }, [client.id, isAdmin])

  async function toggleVersions() {
    const next = !versionsOpen
    setVersionsOpen(next)
    if (!next) setShowAllVersions(false)
    if (next && versions.length === 0) await loadVersions()
  }

  async function restoreVersion(versionId: string) {
    setRestoring(versionId)
    const body: Record<string, unknown> = { version_id: versionId }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings/prompt-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const restoredContent = data.restored_content as string | undefined
      if (restoredContent) {
        setPrompt(prev => ({ ...prev, [client.id]: restoredContent }))
      }
      setVersionsOpen(false)
      await loadVersions()
    }
    setRestoring(null)
  }

  async function saveSetup() {
    setSetupSaving(true)
    setSetupSaved(false)
    const body: Record<string, unknown> = {
      forwarding_number: forwardingNumber[client.id] || '',
      transfer_conditions: transferConditions[client.id] || '',
      setup_complete: setupComplete[client.id],
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSetupSaving(false)
    if (res.ok) {
      setSetupSaved(true)
      if (setupComplete[client.id]) setSetupEditing(false)
      setTimeout(() => setSetupSaved(false), 3000)
    }
  }

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (<>
      {!isAdmin && (
        <p className="text-[11px] t3 -mb-1">Configure what your agent knows and how it handles calls.</p>
      )}

      {/* 0 — Setup */}
      {!isAdmin && ((!setupComplete[client.id] || setupEditing) ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] overflow-hidden">
          <button
            onClick={() => setSetupCollapsed(c => !c)}
            className="w-full px-5 py-3 border-b border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/[0.04] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-400 flex-1 text-left">Start here — complete your setup</p>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              className="text-amber-400/60 shrink-0 transition-transform duration-200"
              style={{ transform: setupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <AnimatePresence initial={false}>
          {!setupCollapsed && (
          <motion.div
            key="setup-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs t3 mb-1.5">Your AI phone number</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono t1">{fmtPhone(client.twilio_number) || 'Not yet assigned'}</span>
                {client.twilio_number && <CopyButton value={client.twilio_number} label="Copy" />}
              </div>
              <p className="text-[11px] t3 mt-1">Share this number — callers will reach your AI agent here.</p>
            </div>
            <div>
              <label className="text-xs t2 mb-1.5 flex items-center gap-2">
                Call forwarding number
                <span className="text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Beta</span>
              </label>
              <input
                type="tel"
                value={forwardingNumber[client.id] ?? ''}
                onChange={(e) => setForwardingNumber(prev => ({ ...prev, [client.id]: e.target.value }))}
                placeholder="+1 (555) 555-5555"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20"
              />
              <p className="text-[11px] t3 mt-1">Your personal number. When a live transfer is triggered, the caller is connected here immediately.</p>
            </div>
            <div>
              <label className="text-xs t2 mb-1.5 block">Transfer conditions</label>
              <textarea
                rows={2}
                value={transferConditions[client.id] ?? ''}
                onChange={(e) => setTransferConditions(prev => ({ ...prev, [client.id]: e.target.value }))}
                placeholder="e.g. the caller explicitly says it's an emergency or urgently insists on speaking to a human"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 resize-none"
              />
              <p className="text-[11px] t3 mt-1">Describe when your agent should offer a live transfer. Leave blank to use the default (emergency or explicit human request only).</p>
            </div>
            {/* Setup checklist */}
            <div className="rounded-2xl bg-surface border b-theme p-4 space-y-3">
              <p className="text-xs font-medium t2">Setup Checklist</p>
              <div className="space-y-2">
                {/* Item 1: Phone number */}
                <div className="flex items-center gap-2.5">
                  {client.twilio_number ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 shrink-0" />
                  )}
                  <span className={`text-xs ${client.twilio_number ? 't2' : 't3'}`}>AI phone number assigned</span>
                </div>
                {/* Item 2: Forwarding configured */}
                <div className="flex items-center gap-2.5">
                  {forwardingNumber[client.id] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 shrink-0" />
                  )}
                  <span className={`text-xs ${forwardingNumber[client.id] ? 't2' : 't3'}`}>Call forwarding configured</span>
                </div>
                {/* Item 3: Setup complete */}
                <div className="flex items-center gap-2.5">
                  {setupComplete[client.id] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-500/60 shrink-0" />
                  )}
                  <span className={`text-xs ${setupComplete[client.id] ? 't2' : 't3'}`}>Setup marked complete</span>
                </div>
              </div>
              {/* Activate Agent button — shown when phone + forwarding are set */}
              {(client.twilio_number && forwardingNumber[client.id]) && !setupComplete[client.id] && (
                <button
                  onClick={() => {
                    setSetupComplete(prev => ({ ...prev, [client.id]: true }))
                    setTimeout(() => saveSetup(), 0)
                  }}
                  disabled={setupSaving || previewMode}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-50"
                >
                  {setupSaving ? 'Activating…' : 'Activate Agent'}
                </button>
              )}
              {setupComplete[client.id] && (
                <button
                  onClick={() => {
                    setSetupComplete(prev => ({ ...prev, [client.id]: false }))
                    setTimeout(() => saveSetup(), 0)
                  }}
                  disabled={setupSaving || previewMode}
                  className="text-[11px] t3 hover:t2 transition-colors"
                >
                  Reset setup status
                </button>
              )}
              {!client.twilio_number && (
                <button
                  onClick={saveSetup}
                  disabled={setupSaving || previewMode}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 disabled:opacity-50 transition-colors"
                >
                  {setupSaving ? 'Saving…' : 'Save setup'}
                </button>
              )}
              {setupSaved && <span className="text-xs text-green-400 block">Saved</span>}
              {setupEditing && (
                <button onClick={() => setSetupEditing(false)} className="text-xs t3 hover:t1 transition-colors block">Cancel</button>
              )}
            </div>
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs t2">Setup complete</span>
            {client.twilio_number && (
              <span className="text-xs font-mono t3">{fmtPhone(client.twilio_number)}</span>
            )}
          </div>
          <button onClick={() => setSetupEditing(true)} className="text-xs t3 hover:t1 transition-colors">Edit</button>
        </div>
      ))}

      {/* Call Forwarding Quick Link */}
      {!isAdmin && client.twilio_number && !setupComplete[client.id] && (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs t2">Need help forwarding calls to <span className="font-mono">{fmtPhone(client.twilio_number)}</span>?</span>
          </div>
          <a href="/dashboard/setup" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
            Carrier instructions
          </a>
        </div>
      )}

      {/* 1 — Agent Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
        <AgentOverviewCard
          client={client}
          isAdmin={isAdmin}
          isActive={isActive}
          onToggleStatus={toggleStatus}
          previewMode={previewMode}
        />
        {isAdmin && !setupComplete[client.id] && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleMarkSetupComplete}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
            >
              Setup incomplete · Mark as done →
            </button>
          </div>
        )}
      </motion.div>

      {/* 1.5 — Voice Style Preset */}
      <VoiceStyleCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialPreset={voiceStylePreset[client.id] ?? 'casual_friendly'}
        previewMode={previewMode}
      />

      {/* 2 — Webhooks + Phone (collapsible, admin only) */}
      {isAdmin && (
        <WebhooksCard appUrl={appUrl} slug={client.slug} twilioNumber={client.twilio_number} />
      )}

      {/* 3 — Agent Configuration (admin only) */}
      {isAdmin && (
        <AgentConfigCard
          clientId={client.id}
          isAdmin={isAdmin}
          agentVoiceId={client.agent_voice_id}
          ultravoxAgentId={client.ultravox_agent_id}
          telegramChatId={client.telegram_chat_id}
        />
      )}

      {/* 3b — Advanced Config (admin only) */}
      {isAdmin && godConfig[client.id] && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-600 dark:text-amber-400/80">Advanced Config</p>
              <p className="text-[11px] t3 mt-0.5">Editable infrastructure settings</p>
            </div>
            <button
              onClick={saveGodConfig}
              disabled={godSaving || previewMode}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                godSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
              }`}
            >
              {godSaving ? 'Saving…' : godSaved ? '✓ Saved' : 'Save Config'}
            </button>
          </div>

          <div className="space-y-3">
            {/* Telegram Bot Token */}
            <div>
              <label className="text-[11px] t3 block mb-1">Telegram Bot Token <span className="t3">(write-only — current value masked)</span></label>
              <input
                type="password"
                value={godConfig[client.id].telegram_bot_token}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], telegram_bot_token: e.target.value } }))}
                placeholder="Enter new token to update…"
                autoComplete="off"
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Telegram Chat ID */}
            <div>
              <label className="text-[11px] t3 block mb-1">Telegram Chat ID</label>
              <input
                type="text"
                value={godConfig[client.id].telegram_chat_id}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], telegram_chat_id: e.target.value } }))}
                placeholder="e.g. 7278536150"
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <button
                type="button"
                onClick={testTelegram}
                disabled={telegramTest[client.id] !== 'idle'}
                className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                  telegramTest[client.id] === 'ok'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : telegramTest[client.id] === 'fail'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-hover t2 border b-theme hover:bg-hover'
                }`}
              >
                {telegramTest[client.id] === 'testing' ? 'Sending…'
                  : telegramTest[client.id] === 'ok' ? '✓ Delivered'
                  : telegramTest[client.id] === 'fail' ? '✗ Failed'
                  : 'Send Test Message'}
              </button>
            </div>

            {/* Twilio Number */}
            <div>
              <label className="text-[11px] t3 block mb-1">Twilio Number</label>
              <input
                type="text"
                value={godConfig[client.id].twilio_number}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], twilio_number: e.target.value } }))}
                placeholder="+15871234567"
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Timezone + Monthly Limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] t3 block mb-1">Timezone</label>
                <select
                  value={godConfig[client.id].timezone}
                  onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], timezone: e.target.value } }))}
                  className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-amber-500/40 transition-colors"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] t3 block mb-1">Monthly Minute Limit</label>
                <input
                  type="number"
                  value={godConfig[client.id].monthly_minute_limit}
                  onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], monthly_minute_limit: Number(e.target.value) } }))}
                  min={0}
                  step={50}
                  className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4c — Booking (gated by niche capability) */}
      {hasCapability(niche, 'bookAppointments') && (
        <BookingCard
          clientId={client.id}
          isAdmin={isAdmin}
          calendarAuthStatus={client.calendar_auth_status}
          googleCalendarId={client.google_calendar_id}
          initialDuration={bookingDuration[client.id] ?? 60}
          initialBuffer={bookingBuffer[client.id] ?? 15}
          previewMode={previewMode}
        />
      )}

      {/* 5 — System Prompt (collapsible) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
      <div className={`rounded-2xl overflow-hidden transition-colors ${promptCollapsed ? 'border border-blue-500/25 bg-blue-500/[0.03]' : 'border border-blue-500/20 bg-surface'}`}>
        <button
          onClick={() => setPromptCollapsed(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-hover transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${promptCollapsed ? 'bg-blue-500/15' : 'bg-blue-500/10'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-blue-400">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-blue-400/80">{isAdmin ? 'Agent Script' : 'Agent Behavior'}</p>
              <p className="text-[11px] t3 mt-0.5">
                {promptCollapsed
                  ? (isAdmin ? 'Tap to view and edit what your AI agent says on calls' : 'See what your agent does on calls')
                  : (isAdmin ? `${nicheConfig.label} agent instructions` : 'What your agent does on every call')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {promptCollapsed && isAdmin && (
              <span className="text-[10px] font-medium text-blue-400/60 group-hover:text-blue-400/90 transition-colors hidden sm:block">Edit</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              className={`text-blue-400/50 group-hover:text-blue-400/80 transition-all duration-200 shrink-0 ${promptCollapsed ? '' : 'rotate-180'}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
        <AnimatePresence initial={false}>
          {!promptCollapsed && (
            <motion.div
              key="prompt-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5 border-t b-theme">
                {isAdmin ? (
                  <>
                    <div className="flex items-center justify-between mt-4 mb-3">
                      <p className="text-[11px] t3">
                        Edit your agent&apos;s script below. Changes go live as soon as you save.
                      </p>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className={`text-xs tabular-nums font-mono ${charCount > 8000 ? 'text-red-400' : charCount > 7000 ? 'text-amber-400' : 't3'}`}>
                          {charCount.toLocaleString()} / 8,000 chars (~{Math.ceil(charCount / 4).toLocaleString()} tokens)
                        </span>
                        {dirty && (
                          <input
                            type="text"
                            placeholder="What changed? (optional)"
                            value={changeDesc}
                            onChange={e => setChangeDesc(e.target.value)}
                            className="px-3 py-1.5 rounded-xl text-xs bg-hover border b-theme t2 placeholder:t3 focus:outline-none focus:border-zinc-500 w-48"
                          />
                        )}
                        <button
                          onClick={save}
                          disabled={!dirty || saving || charCount > 8000 || previewMode}
                          title={charCount > 8000 ? 'Prompt exceeds 8,000 character limit' : undefined}
                          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            charCount > 8000
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed'
                              : saved
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : dirty
                              ? 'bg-blue-500 hover:bg-blue-400 text-white'
                              : 'bg-hover t3 cursor-not-allowed border b-theme'
                          }`}
                        >
                          {charCount > 8000 ? 'Over limit' : saving ? 'Saving…' : (
                            <AnimatePresence mode="wait">
                              {saved ? (
                                <motion.span
                                  key="saved"
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                  Saved ✓
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="unsaved"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  Save Changes
                                </motion.span>
                              )}
                            </AnimatePresence>
                          )}
                        </button>
                        <ShimmerButton
                          onClick={handleRegen}
                          disabled={regenState === 'loading' || regenCooldownLeft > 0}
                          className="text-sm"
                          shimmerColor="rgba(99,102,241,0.5)"
                        >
                          {regenState === 'loading' ? 'Re-generating…' : regenState === 'done' ? 'Done!' : regenState === 'partial' ? 'Regenerated — syncing to agent…' : regenState === 'error' ? 'Error — try again' : regenCooldownLeft > 0 ? `Wait ${Math.floor(regenCooldownLeft / 60)}:${String(regenCooldownLeft % 60).padStart(2, '0')}` : 'Re-generate from template'}
                        </ShimmerButton>
                      </div>
                      {client.updated_at && (
                        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-3)' }}>
                          Agent last updated {(() => {
                            const diff = Date.now() - new Date(client.updated_at!).getTime()
                            const mins = Math.floor(diff / 60000)
                            if (mins < 1) return 'just now'
                            if (mins < 60) return `${mins}m ago`
                            const hrs = Math.floor(mins / 60)
                            if (hrs < 24) return `${hrs}h ago`
                            return `${Math.floor(hrs / 24)}d ago`
                          })()}
                        </p>
                      )}
                    </div>

                    {dirty && (
                      <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
                          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-[11px] text-amber-400/90">Unsaved changes — deploy to update the live agent</span>
                      </div>
                    )}

                    {saveUltravoxWarning && (
                      <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/[0.07] border border-orange-500/20">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-orange-400 shrink-0">
                          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-[11px] text-orange-400/90">{saveUltravoxWarning}</span>
                      </div>
                    )}

                    {/* Prompt char progress bar */}
                    <div className="mb-3">
                      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            charCount > 8000 ? 'bg-red-500' : charCount > 7000 ? 'bg-amber-500' : 'bg-blue-500/60'
                          }`}
                          style={{ width: `${Math.min((charCount / 8000) * 100, 100)}%` }}
                        />
                      </div>
                      {charCount > 8000 && (
                        <p className="text-[10px] text-red-400 mt-1">
                          Over limit by {(charCount - 8000).toLocaleString()} chars. Remove content before saving.
                        </p>
                      )}
                    </div>

                    {savePromptWarnings.length > 0 && (
                      <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-amber-400">Prompt warnings</span>
                          <button onClick={() => setSavePromptWarnings([])} className="text-[10px] text-amber-400/60 hover:text-amber-400">
                            Dismiss
                          </button>
                        </div>
                        <ul className="space-y-0.5">
                          {savePromptWarnings.map((w, i) => (
                            <li key={i} className="text-[10px] text-amber-400/80 leading-relaxed">• {w.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {saveError && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-red-400 shrink-0">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[11px] text-red-400/90">{saveError}</span>
                      </div>
                    )}

                    <textarea
                      value={currentPrompt}
                      onChange={e => setPrompt(prev => ({ ...prev, [client.id]: e.target.value }))}
                      className="w-full h-[480px] bg-black/20 border b-theme rounded-xl p-4 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
                      spellCheck={false}
                      placeholder={`Enter your ${nicheConfig.label} agent's system prompt…`}
                    />
                  </>
                ) : (
                  /* ── Client behavior summary (replaces raw prompt editor) ── */
                  <div className="mt-4 space-y-3">
                    <div className="px-4 py-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/15">
                      <p className="text-xs font-semibold t1 mb-2.5">How your agent behaves</p>
                      <ul className="space-y-1.5">
                        {client.agent_name && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Greets callers as {client.agent_name}
                          </li>
                        )}
                        <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                          <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                          Collects callback details and takes messages
                        </li>
                        {(client.business_facts || (client.extra_qa && client.extra_qa.length > 0)) && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Answers common business questions
                          </li>
                        )}
                        {client.sms_enabled && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Sends a follow-up text after calls
                          </li>
                        )}
                        {client.business_hours_weekday && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Uses your business hours and after-hours rules
                          </li>
                        )}
                        {client.forwarding_number && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Transfers urgent calls to {fmtPhone(client.forwarding_number)}
                          </li>
                        )}
                        {client.booking_enabled && client.calendar_auth_status === 'connected' && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            Books appointments on your Google Calendar
                          </li>
                        )}
                        {client.knowledge_backend === 'pgvector' && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            {client.knowledge_backend === 'pgvector' ? 'Searches your knowledge base for detailed answers' : 'Looks up answers from your uploaded documents'}
                          </li>
                        )}
                        {client.context_data && (
                          <li className="flex items-start gap-2 text-[11px] t2 leading-relaxed">
                            <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                            References your {client.context_data_label || 'reference data'} for lookups
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <p className="text-[10px] t3 leading-relaxed">
                          Need behavior changes? Update your business details above, or contact support for advanced customization.
                        </p>
                        {versions.length > 0 && (
                          <p className="text-[10px] t3 mt-1">
                            Last updated {(() => {
                              const mins = Math.floor((Date.now() - new Date(versions[0].created_at).getTime()) / 60000)
                              if (mins < 1) return 'just now'
                              if (mins < 60) return `${mins}m ago`
                              const hrs = Math.floor(mins / 60)
                              if (hrs < 24) return `${hrs}h ago`
                              return `${Math.floor(hrs / 24)}d ago`
                            })()}
                            {versions[0].triggered_by_role && <> by <span className="font-medium t2">{versions[0].triggered_by_role}</span></>}
                          </p>
                        )}
                      </div>
                      <ShimmerButton
                        onClick={handleRegen}
                        disabled={regenState === 'loading' || previewMode || regenCooldownLeft > 0}
                        className="text-sm shrink-0 ml-3"
                        shimmerColor="rgba(99,102,241,0.5)"
                      >
                        {regenState === 'loading' ? 'Refreshing…' : regenState === 'done' ? 'Updated!' : regenState === 'partial' ? 'Saved — syncing…' : regenState === 'error' ? 'Error — try again' : regenCooldownLeft > 0 ? `Wait ${Math.floor(regenCooldownLeft / 60)}:${String(regenCooldownLeft % 60).padStart(2, '0')}` : 'Refresh Agent'}
                      </ShimmerButton>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </motion.div>

      {/* 5x — Capabilities card (client view only) */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.01 }}
        >
          <CapabilitiesCard client={client} />
        </motion.div>
      )}

      {/* 5y — Runtime config card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.012 }}
      >
        <RuntimeCard client={client} />
      </motion.div>

      {/* 5b-pre — Knowledge Engine Card (visible to both admin and client) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.014 }}
      >
        <KnowledgeEngineCard client={client} isAdmin={isAdmin} previewMode={previewMode} />
      </motion.div>

      {/* 5a — Test Call */}
      <TestCallCard clientId={client.id} isAdmin={isAdmin} previewMode={previewMode} />

      {/* 5b — Learning Loop */}
      {learningState === 'checking' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border b-theme text-xs t3">
          <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-400 animate-spin shrink-0" />
          Checking call patterns…
        </div>
      )}

      {learningState === 'analyzing' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/20 text-xs text-blue-400/80">
          <div className="w-3 h-3 rounded-full border border-blue-500/30 border-t-blue-400 animate-spin shrink-0" />
          Analyzing {learning?.calls_since_last_analysis ?? 'recent'} calls for prompt improvements…
        </div>
      )}

      {learningState === 'ready' && learning?.pending_report && !learningDismissed && (
        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.04] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-blue-400/80">Learning Loop</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">Auto</span>
              </div>
              <p className="text-xs t2">
                {learning.trigger_reason === 'friction_call' && 'A recent call had friction — agent may need a prompt update.'}
                {learning.trigger_reason === 'unknown_status' && "A call couldn't be classified — reviewing prompt gaps."}
                {learning.trigger_reason === 'frustrated' && 'A caller sounded frustrated — checking for prompt issues.'}
                {learning.trigger_reason === 'short_call' && 'A caller hung up fast — checking if the agent is missing something.'}
                {learning.trigger_reason === 'cadence' && `${learning.calls_since_last_analysis} new calls since last analysis.`}
                {!learning.trigger_reason && 'New learning insights available.'}
                {' '}Found {learning.pending_report.recommendations_count} suggestion{learning.pending_report.recommendations_count !== 1 ? 's' : ''}.
              </p>
            </div>
            <button
              onClick={dismissLearning}
              className="text-[10px] t3 hover:t1 transition-colors shrink-0 mt-0.5"
            >
              Dismiss
            </button>
          </div>

          {learning.pending_report.top_recs.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border b-theme space-y-2">
              {learning.pending_report.top_recs.map((rec, i) => (
                <div key={i} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
                      rec.priority === 'high'
                        ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                        : rec.priority === 'medium'
                        ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                        : 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20'
                    }`}>{rec.priority}</span>
                    <span className="t1 font-medium">{rec.title}</span>
                  </div>
                  <p className="t3 leading-relaxed">{rec.rationale}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={generateImprovement}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all"
          >
            Apply Suggestions to Prompt
          </button>
        </div>
      )}

      {/* 6 — AI Improve Prompt (Beta) — admin only */}
      {isAdmin && (<div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-purple-400/80">AI Improve</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">Beta</span>
          </div>
          {(improveState === 'idle' || improveState === 'error') && (
            <button
              onClick={generateImprovement}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
            >
              Generate Improvement
            </button>
          )}
        </div>
        <p className="text-[11px] t3 mb-4">
          AI reads your last 10 calls and your current prompt to suggest targeted improvements. Review before applying.
        </p>

        {improveState === 'loading' && (
          <div className="flex items-center gap-2 py-4 t2 text-xs">
            <div className="w-4 h-4 rounded-full border border-purple-400/30 border-t-purple-400 animate-spin shrink-0" />
            Analyzing recent calls and your prompt…
          </div>
        )}

        {improveState === 'error' && (
          <div className="px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20 text-xs text-red-400">
            {improveError}
          </div>
        )}

        {improveState === 'done' && improveResult && (
          <div className="space-y-3">
            {!improveResult.has_enough_data && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 text-xs text-amber-400/90">
                Only {improveResult.call_count} calls recorded — improvement is based on your business profile. More calls = better results.
              </div>
            )}

            {improveResult.changes.length > 0 && (
              <div className="px-3 py-3 rounded-xl bg-hover border b-theme">
                <p className="text-[10px] font-semibold t3 uppercase tracking-wider mb-2">What changed</p>
                <ul className="space-y-1">
                  {improveResult.changes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs t2">
                      <span className="text-purple-400 mt-0.5 shrink-0">·</span>
                      <span><span className="font-semibold t1">{item.section}</span> — {item.what}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <textarea
              readOnly
              value={improveResult.improved_prompt}
              className="w-full h-48 bg-black/20 border b-theme rounded-xl p-4 text-xs t2 font-mono resize-none focus:outline-none leading-relaxed"
            />

            <div className="flex gap-2">
              <button
                onClick={applyImprovedPrompt}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-white transition-all"
              >
                Apply to Editor
              </button>
              <button
                onClick={() => { setImproveResult(null); setImproveState('idle') }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold t3 hover:t1 border b-theme hover:b-theme transition-all"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[10px] t3">
              After applying, review the prompt above and click &ldquo;Save Changes&rdquo; to deploy it live.
            </p>
          </div>
        )}
      </div>)}

      {/* 7 — Prompt Version History (admin only) */}
      {isAdmin && <><motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.06 }}
      >
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <button
          onClick={toggleVersions}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
        >
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Prompt History</p>
            <p className="text-[11px] t3 mt-0.5">View and restore previous system prompt versions</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            className={`t3 transition-transform ${versionsOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {versionsOpen && (
            <motion.div
              key="versions-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ overflow: 'hidden' }}
            >
          <div className="border-t b-theme">
            {versionsLoading ? (
              <div className="flex items-center gap-2 px-5 py-4 text-xs t3">
                <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-400 animate-spin" />
                Loading history…
              </div>
            ) : versions.length === 0 ? (
              <p className="px-5 py-4 text-xs t3">No saved versions yet. Saving the prompt creates a version.</p>
            ) : (
              <>
                <div className="divide-y divide-white/[0.04]">
                  {(showAllVersions ? versions : versions.slice(0, 5)).map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold t2">v{v.version}</span>
                          {v.is_active && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">Active</span>
                          )}
                          <span className="text-[11px] t3">
                            {new Date(v.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {v.triggered_by_role && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] t3 border border-white/[0.06]">{v.triggered_by_role}</span>
                          )}
                          {v.char_count != null && v.prev_char_count != null && v.char_count !== v.prev_char_count && (
                            <span className={`text-[9px] font-mono ${v.char_count > v.prev_char_count ? 'text-green-400' : 'text-amber-400'}`}>
                              {v.char_count > v.prev_char_count ? '+' : ''}{v.char_count - v.prev_char_count}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] t3 truncate mt-0.5">{v.change_description}</p>
                      </div>
                      <button
                        onClick={() => setViewingVersion(v)}
                        className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-hover t2 hover:bg-hover hover:t1 border b-theme transition-all"
                      >
                        View →
                      </button>
                      {!v.is_active && isAdmin && (
                        <button
                          onClick={() => restoreVersion(v.id)}
                          disabled={restoring === v.id}
                          className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-hover t2 hover:bg-hover hover:t1 border b-theme transition-all disabled:opacity-40"
                        >
                          {restoring === v.id ? 'Restoring…' : 'Restore'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!showAllVersions && versions.length > 5 && (
                  <button
                    onClick={() => setShowAllVersions(true)}
                    className="w-full px-5 py-2 text-[11px] t3 hover:t1 transition-colors"
                  >
                    Show {versions.length - 5} older versions
                  </button>
                )}
              </>
            )}
          </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </motion.div>

      {/* ─── Prompt Version View Modal ───────────────────────────────── */}
      {viewingVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setViewingVersion(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[80vh] mx-4 rounded-2xl border b-theme bg-surface overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b b-theme shrink-0">
              <div>
                <span className="text-xs font-mono font-semibold t2">v{viewingVersion.version}</span>
                {viewingVersion.is_active && (
                  <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">Active</span>
                )}
                <span className="text-[11px] t3 ml-2">
                  {new Date(viewingVersion.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {viewingVersion.change_description && (
                  <p className="text-[11px] t3 mt-0.5">{viewingVersion.change_description}</p>
                )}
              </div>
              <button onClick={() => setViewingVersion(null)} className="t3 hover:t1 transition-colors text-xl leading-none ml-4">×</button>
            </div>
            <pre className="flex-1 overflow-auto px-5 py-4 text-xs t2 font-mono whitespace-pre-wrap">{viewingVersion.content}</pre>
          </div>
        </div>
      )}
      </>}

      {/* 8a — Right Now (injected_note) — REMOVED: duplicate of Quick Inject in AgentOverviewCard */}

      {/* 8a2 — Hours & After-Hours (A3) */}
      <HoursCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialWeekday={hoursWeekday[client.id] ?? ''}
        initialWeekend={hoursWeekend[client.id] ?? ''}
        initialBehavior={afterHoursBehavior[client.id] ?? 'take_message'}
        initialPhone={afterHoursPhone[client.id] ?? ''}
        previewMode={previewMode}
      />

      {/* S14 — Voicemail Greeting */}
      <VoicemailGreetingCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialText={client.voicemail_greeting_text ?? ''}
        businessName={client.business_name}
        hasAudioGreeting={!!client.voicemail_greeting_audio_url}
        previewMode={previewMode}
      />

      {/* 8c — Section Editors (admin-only — marker parsing) */}
      {isAdmin && [
        { id: 'identity', label: 'Agent Identity', desc: 'Agent name, greeting, and personality', rows: 6 },
        { id: 'knowledge', label: 'Knowledge Base', desc: 'Upload documents for your agent to search through — policies, procedures, or detailed guides.', rows: 10 },
      ].map(({ id, label, desc, rows }) => (
        <SectionEditorCard
          key={id}
          clientId={client.id}
          isAdmin={isAdmin}
          sectionId={id}
          label={label}
          desc={desc}
          rows={rows}
          initialContent={(sectionContent[client.id] ?? {})[id] ?? ''}
          hasMarker={id in (sectionContent[client.id] ?? {})}
          previewMode={previewMode}
        />
      ))}

      {/* 8b — Advanced Context */}
      <AdvancedContextCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialFacts={businessFacts[client.id] ?? ''}
        initialQA={extraQA[client.id] ?? []}
        initialContextData={contextData[client.id] ?? ''}
        initialContextDataLabel={contextDataLabel[client.id] ?? ''}
        prompt={prompt[client.id] ?? ''}
        previewMode={previewMode}
      />

  </>)
}
