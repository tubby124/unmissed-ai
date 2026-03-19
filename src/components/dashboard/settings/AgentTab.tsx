'use client'

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import ShimmerButton from '@/components/ui/shimmer-button'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import { NICHE_CONFIG } from '@/lib/niche-config'
import { fmtPhone } from '@/lib/settings-utils'
import { parsePromptSections } from '@/lib/prompt-sections'
import type { PromptVersion, ImproveResult, LearningStatus, GodConfigEntry } from './constants'
import { TIMEZONES, KNOWN_VOICES } from './constants'
import { fmtDate, CopyButton, UrlRow, ConfigRow } from './shared'

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
}: AgentTabProps) {
  // ─── Transient internal state ──────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveUltravoxWarning, setSaveUltravoxWarning] = useState<string | null>(null)
  const [changeDesc, setChangeDesc] = useState('')

  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'done' | 'partial' | 'error'>('idle')

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

  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null)
  const [showAllVersions, setShowAllVersions] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [syncError, setSyncError] = useState('')

  const [godSaving, setGodSaving] = useState(false)
  const [godSaved, setGodSaved] = useState(false)

  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  const [sectionSaving, setSectionSaving] = useState<Record<string, Record<string, boolean>>>({})
  const [sectionSaved, setSectionSaved] = useState<Record<string, Record<string, boolean>>>({})
  const [sectionError, setSectionError] = useState<Record<string, Record<string, string>>>({})
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, Record<string, boolean>>>(() => ({ [client.id]: {} }))

  const [advancedSaving, setAdvancedSaving] = useState(false)
  const [advancedSaved, setAdvancedSaved] = useState(false)
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false)

  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingSaved, setBookingSaved] = useState(false)

  const [presetSaving, setPresetSaving] = useState(false)
  const [presetSaved, setPresetSaved] = useState(false)

  const [testPhone, setTestPhone] = useState('')
  const [testCallState, setTestCallState] = useState<'idle' | 'calling' | 'done' | 'error'>('idle')
  const [testCallResult, setTestCallResult] = useState<{ callId?: string; twilio_sid?: string } | null>(null)
  const [testCallError, setTestCallError] = useState('')

  const [promptCollapsed, setPromptCollapsed] = useState(isAdmin)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(true)

  const [setupCollapsed, setSetupCollapsed] = useState(() => !!(client.setup_complete || client.twilio_number))
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupSaved, setSetupSaved] = useState(false)
  const [setupEditing, setSetupEditing] = useState(false)

  // ─── Derived values ────────────────────────────────────────────────────────
  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const voiceName = client.agent_voice_id ? (KNOWN_VOICES[client.agent_voice_id] ?? null) : null
  const currentPrompt = prompt[client.id] ?? ''
  const originalPrompt = client.system_prompt ?? ''
  const dirty = currentPrompt !== originalPrompt
  const charCount = currentPrompt.length
  const inboundUrl = `${appUrl}/api/webhook/${client.slug}/inbound`
  const completedUrl = `${appUrl}/api/webhook/${client.slug}/completed`
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
    } else {
      const d = await res.json().catch(() => ({}))
      setSaveError(d.error || 'Save failed — try again.')
      setTimeout(() => setSaveError(''), 5000)
    }
  }

  async function saveSection(sectionId: string, content: string) {
    setSectionSaving(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: true } }))
    setSectionError(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: '' } }))
    setSectionSaved(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: false } }))
    const body: Record<string, unknown> = { section_id: sectionId, section_content: content }
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Save failed')
      }
      setSectionContent(prev => ({
        ...prev,
        [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: content },
      }))
      // Bug 6: sync A3 form state when hours section saved via section editor
      if (sectionId === 'hours') {
        const WEEKDAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|mon|tue|wed|thu|fri|weekday|weekdays|daily|monday.{0,10}friday|mon.{0,5}fri)\b/i
        const WEEKEND_RE = /\b(saturday|sunday|weekend|sat|sun|saturday.{0,10}sunday|sat.{0,5}sun)\b/i
        for (const raw of content.split('\n')) {
          const line = raw.trim()
          if (!line) continue
          if (WEEKDAY_RE.test(line) && !WEEKEND_RE.test(line))
            setHoursWeekday(prev => ({ ...prev, [client.id]: line }))
          else if (WEEKEND_RE.test(line) && !WEEKDAY_RE.test(line))
            setHoursWeekend(prev => ({ ...prev, [client.id]: line }))
        }
      }
      setSectionSaved(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: true } }))
      setTimeout(() => setSectionSaved(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: false } })), 2500)
    } catch (err) {
      setSectionError(prev => ({
        ...prev,
        [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: String(err instanceof Error ? err.message : err) },
      }))
    } finally {
      setSectionSaving(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: false } }))
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

  async function syncAgent() {
    setSyncing(true)
    setSyncState('idle')
    setSyncError('')
    const body: Record<string, unknown> = {}
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/settings/sync-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSyncState('ok')
        setSaveUltravoxWarning(null)
        setTimeout(() => setSyncState('idle'), 3000)
      } else {
        setSyncState('error')
        setSyncError(data.error || 'Sync failed')
      }
    } catch {
      setSyncState('error')
      setSyncError('Network error')
    }
    setSyncing(false)
  }

  async function saveAdvanced() {
    setAdvancedSaving(true)
    setAdvancedSaved(false)
    const body: Record<string, unknown> = {
      business_facts: businessFacts[client.id] ?? '',
      extra_qa: extraQA[client.id] ?? [],
      context_data: contextData[client.id] ?? '',
      context_data_label: contextDataLabel[client.id] ?? '',
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setAdvancedSaving(false)
    if (res.ok) {
      setAdvancedSaved(true)
      setTimeout(() => setAdvancedSaved(false), 3000)
    }
  }

  async function saveHoursConfig() {
    setHoursSaving(true)
    setHoursSaved(false)
    const body: Record<string, unknown> = {
      business_hours_weekday: hoursWeekday[client.id] ?? '',
      business_hours_weekend: hoursWeekend[client.id] ?? '',
      after_hours_behavior: afterHoursBehavior[client.id] ?? 'take_message',
      after_hours_emergency_phone: afterHoursPhone[client.id] ?? '',
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setHoursSaving(false)
    if (res.ok) {
      setHoursSaved(true)
      setTimeout(() => setHoursSaved(false), 3000)
    }
  }

  async function saveBookingConfig() {
    setBookingSaving(true)
    setBookingSaved(false)
    const body: Record<string, unknown> = {
      booking_service_duration_minutes: bookingDuration[client.id] ?? 30,
      booking_buffer_minutes: bookingBuffer[client.id] ?? 0,
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBookingSaving(false)
    if (res.ok) {
      setBookingSaved(true)
      setTimeout(() => setBookingSaved(false), 3000)
    }
  }

  async function saveVoiceStylePreset() {
    setPresetSaving(true)
    setPresetSaved(false)
    const body: Record<string, unknown> = {
      voice_style_preset: voiceStylePreset[client.id] ?? 'casual_friendly',
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setPresetSaving(false)
    if (res.ok) {
      setPresetSaved(true)
      setTimeout(() => setPresetSaved(false), 3000)
    }
  }

  async function fireTestCall() {
    if (!testPhone.trim()) return
    setTestCallState('calling')
    setTestCallResult(null)
    setTestCallError('')
    const body: Record<string, unknown> = { to_phone: testPhone.trim() }
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTestCallState('done')
        setTestCallResult({ callId: data.callId, twilio_sid: data.twilio_sid })
      } else {
        setTestCallState('error')
        setTestCallError(data.error || 'Failed to start test call')
      }
    } catch {
      setTestCallState('error')
      setTestCallError('Network error')
    }
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
                  disabled={setupSaving}
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
                  disabled={setupSaving}
                  className="text-[11px] t3 hover:t2 transition-colors"
                >
                  Reset setup status
                </button>
              )}
              {!client.twilio_number && (
                <button
                  onClick={saveSetup}
                  disabled={setupSaving}
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.03 }}
      >
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Voice Style</p>
          </div>
          <p className="text-[11px] t3 mt-1">How your agent sounds on calls — tone, pacing, and filler words.</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: 'casual_friendly', label: 'Casual & Friendly', desc: 'Warm, upbeat, uses fillers and slang' },
            { id: 'professional_warm', label: 'Professional & Warm', desc: 'Polished but approachable, no slang' },
            { id: 'direct_efficient', label: 'Direct & Efficient', desc: 'Minimal small talk, gets to the point' },
            { id: 'empathetic_care', label: 'Empathetic & Patient', desc: 'Extra validation, slower pace, gentle' },
          ] as const).map(p => {
            const selected = (voiceStylePreset[client.id] || 'casual_friendly') === p.id
            return (
              <button
                key={p.id}
                onClick={() => setVoiceStylePreset(prev => ({ ...prev, [client.id]: p.id }))}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected
                    ? 'border-blue-500/60 bg-blue-500/[0.06]'
                    : 'border-white/[0.06] bg-hover hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                    selected ? 'border-blue-400 bg-blue-400' : 'border-zinc-600'
                  }`} />
                  <span className="text-xs font-medium t1">{p.label}</span>
                </div>
                <p className="text-[11px] t3 ml-[18px]">{p.desc}</p>
              </button>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-white/[0.04] flex justify-end">
          <button
            onClick={saveVoiceStylePreset}
            disabled={presetSaving}
            className="text-xs px-4 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] t2 transition-colors disabled:opacity-50"
          >
            {presetSaving ? 'Saving...' : presetSaved ? 'Saved' : 'Save Style'}
          </button>
        </div>
      </div>
      </motion.div>

      {/* 2 — Webhooks + Phone (collapsible, admin only) */}
      {isAdmin && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.06 }}
      >
      <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
        <button
          onClick={() => setWebhooksCollapsed(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
              <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Developer Settings</p>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`t3 transition-transform duration-200 ${webhooksCollapsed ? '' : 'rotate-180'}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {!webhooksCollapsed && (
            <motion.div
              key="webhooks-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5 border-t b-theme">
                <p className="text-[11px] t3 mt-4 mb-3">These URLs are pre-configured in your Twilio console. No action needed.</p>
                <UrlRow label="Inbound" url={inboundUrl} />
                <UrlRow label="Completed" url={completedUrl} />
                <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
                  <span className="text-xs t3 w-24 shrink-0">Twilio Number</span>
                  <span className="flex-1 text-sm font-mono font-medium t1">
                    {fmtPhone(client.twilio_number)}
                  </span>
                  {client.twilio_number && <CopyButton value={client.twilio_number} />}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </motion.div>
      )}

      {/* 3 — Agent Configuration (admin only) */}
      {isAdmin && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.12 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Agent Configuration</p>
        <p className="text-[11px] t3 mb-4">Voice and AI model settings</p>
        {client.agent_voice_id ? (
          <ConfigRow
            label="Voice"
            value={voiceName ? `${voiceName}  ·  ${client.agent_voice_id}` : client.agent_voice_id}
            copyValue={client.agent_voice_id}
          />
        ) : (
          <ConfigRow label="Voice" value="Not configured" />
        )}
        <div className="py-2">
          <a
            href="/dashboard/voices"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Change voice →
          </a>
        </div>
        <ConfigRow label="AI Model" value="Ultravox v0.7 (fixie-ai)" />
        <ConfigRow label="Client ID" value={client.id} copyValue={client.id} />
        {client.telegram_chat_id && (
          <ConfigRow label="Telegram Chat" value={client.telegram_chat_id} copyValue={client.telegram_chat_id} />
        )}
        {client.ultravox_agent_id && (
          <div className="flex items-center gap-3 pt-3 mt-1 border-t b-theme">
            <button
              onClick={syncAgent}
              disabled={syncing}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                syncState === 'ok'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : syncState === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-hover t2 border b-theme hover:bg-hover hover:t1'
              }`}
            >
              {syncing ? 'Syncing…' : syncState === 'ok' ? '✓ Synced' : syncState === 'error' ? '✗ Sync failed' : 'Re-sync Agent'}
            </button>
            <span className="text-[11px] t3">
              {syncState === 'error' ? syncError : 'Force-push current prompt + voice to Ultravox'}
            </span>
          </div>
        )}
      </div>
      </motion.div>
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
              disabled={godSaving}
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

      {/* 4c — Booking (visible to all clients — booking_enabled still admin-gated at API layer) */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400/80">Booking</p>
            </div>
          </div>
          <p className="text-[11px] t3 mb-4">Connect Google Calendar to let your agent check availability and book appointments on live calls.</p>

          {/* Connection status */}
          {client.calendar_auth_status === 'connected' ? (
            <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-xs text-emerald-300">Calendar connected</span>
              {client.google_calendar_id && (
                <span className="text-[10px] font-mono t3 truncate">{client.google_calendar_id}</span>
              )}
            </div>
          ) : client.calendar_auth_status === 'expired' ? (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              Calendar authorization expired — reconnect below.
            </div>
          ) : null}

          {/* Connect button */}
          <a
            href={`/api/auth/google${isAdmin ? `?client_id=${client.id}` : ''}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {client.calendar_auth_status === 'connected' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
          </a>

          {/* Duration + buffer settings (only when connected) */}
          {client.calendar_auth_status === 'connected' && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] t3 block mb-1">Appointment duration</label>
                  <select
                    value={bookingDuration[client.id] ?? 60}
                    onChange={e => setBookingDuration(prev => ({ ...prev, [client.id]: Number(e.target.value) }))}
                    className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
                  >
                    {[30, 45, 60, 90, 120].map(m => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] t3 block mb-1">Buffer between appointments</label>
                  <select
                    value={bookingBuffer[client.id] ?? 15}
                    onChange={e => setBookingBuffer(prev => ({ ...prev, [client.id]: Number(e.target.value) }))}
                    className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-emerald-500/40"
                  >
                    {[0, 10, 15, 30].map(m => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={saveBookingConfig}
                disabled={bookingSaving}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  bookingSaved
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                } disabled:opacity-40`}
              >
                {bookingSaving ? 'Saving…' : bookingSaved ? '✓ Saved' : 'Save Booking Config'}
              </button>
            </div>
          )}
        </div>

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
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-blue-400/80">Agent Script</p>
              <p className="text-[11px] t3 mt-0.5">
                {promptCollapsed
                  ? (isAdmin ? 'Tap to view and edit what your AI agent says on calls' : 'Tap to view your agent\'s script')
                  : `${nicheConfig.label} agent instructions`}
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
                        <span className={`text-xs tabular-nums font-mono ${charCount > 48000 ? 'text-red-400' : charCount > 40000 ? 'text-amber-400' : 't3'}`}>
                          {charCount.toLocaleString()} chars
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
                          disabled={!dirty || saving}
                          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            saved
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : dirty
                              ? 'bg-blue-500 hover:bg-blue-400 text-white'
                              : 'bg-hover t3 cursor-not-allowed border b-theme'
                          }`}
                        >
                          {saving ? 'Saving…' : (
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
                          onClick={async () => {
                            setRegenState('loading')
                            try {
                              const res = await fetch('/api/dashboard/regenerate-prompt', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ clientId: client.id }),
                              })
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
                          }}
                          disabled={regenState === 'loading'}
                          className="text-sm"
                          shimmerColor="rgba(99,102,241,0.5)"
                        >
                          {regenState === 'loading' ? 'Re-generating…' : regenState === 'done' ? 'Done!' : regenState === 'partial' ? 'Regenerated — syncing to agent…' : regenState === 'error' ? 'Error — try again' : 'Re-generate from template'}
                        </ShimmerButton>
                      </div>
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
                  <>
                    <div className="mt-4 mb-3 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
                          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-[11px] font-semibold text-amber-400">Advanced — edit with caution</span>
                      </div>
                      <p className="text-[10px] text-amber-400/70 leading-relaxed">
                        This is your agent&apos;s core script. The settings above (hours, identity, knowledge, quick inject) update it safely without touching this directly. Manual edits here can break your agent&apos;s behavior.
                      </p>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs tabular-nums font-mono ${charCount > 48000 ? 'text-red-400' : charCount > 40000 ? 'text-amber-400' : 't3'}`}>
                        {charCount.toLocaleString()} chars
                      </span>
                      <button
                        onClick={save}
                        disabled={!dirty || saving}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          saved
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : dirty
                            ? 'bg-blue-500 hover:bg-blue-400 text-white'
                            : 'bg-hover t3 cursor-not-allowed border b-theme'
                        }`}
                      >
                        {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
                      </button>
                    </div>
                    <textarea
                      value={currentPrompt}
                      onChange={e => setPrompt(prev => ({ ...prev, [client.id]: e.target.value }))}
                      className="w-full h-[480px] bg-black/20 border b-theme rounded-xl p-4 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
                      spellCheck={false}
                      placeholder={`Enter your ${nicheConfig.label} agent's system prompt…`}
                    />
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </motion.div>

      {/* 5a — Test Call (moved here from bottom for edit-then-test flow) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.02 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Test Call</p>
        <p className="text-[11px] t3 mb-4">
          Trigger the agent to call a phone number. Use after prompt changes to verify the agent sounds right. Logged as a test call in Call Logs.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fireTestCall()}
            placeholder="+14031234567"
            disabled={testCallState === 'calling'}
            className="flex-1 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          />
          <ShimmerButton
            onClick={fireTestCall}
            disabled={!testPhone.trim() || testCallState === 'calling'}
            borderRadius="12px"
            shimmerColor="rgba(99,102,241,0.5)"
            background="rgba(59,130,246,1)"
            className="px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 shrink-0"
          >
            {testCallState === 'calling' ? 'Dialing…' : 'Call Me'}
          </ShimmerButton>
        </div>

        {testCallState === 'done' && testCallResult && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/[0.07] border border-green-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-green-400/90">
              Call started — SID: <span className="font-mono">{testCallResult.twilio_sid?.slice(-8)}</span>
            </span>
            <button
              onClick={() => setTestCallState('idle')}
              className="ml-auto text-[10px] t3 hover:t2"
            >
              Dismiss
            </button>
          </div>
        )}

        {testCallState === 'error' && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20">
            <span className="text-[11px] text-red-400/90 flex-1">{testCallError}</span>
            <button
              onClick={() => setTestCallState('idle')}
              className="text-[10px] t3 hover:t2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
      </motion.div>

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

      {/* 7 — Prompt Version History */}
      <motion.div
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

      {/* 8a — Right Now (injected_note) — REMOVED: duplicate of Quick Inject in AgentOverviewCard */}

      {/* 8a2 — Hours & After-Hours (A3) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Hours &amp; After-Hours</p>
            <p className="text-[11px] t3 mt-0.5">Configure when your agent treats calls as after-hours</p>
          </div>
          <button
            onClick={saveHoursConfig}
            disabled={hoursSaving}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              hoursSaved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
            } disabled:opacity-40`}
          >
            {hoursSaving ? 'Saving…' : hoursSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekday hours</p>
            <input
              type="text"
              value={hoursWeekday[client.id] ?? ''}
              onChange={e => setHoursWeekday(prev => ({ ...prev, [client.id]: e.target.value }))}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Monday to Friday, 9am to 5pm"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">Weekend hours <span className="t3 font-normal">(leave blank if closed)</span></p>
            <input
              type="text"
              value={hoursWeekend[client.id] ?? ''}
              onChange={e => setHoursWeekend(prev => ({ ...prev, [client.id]: e.target.value }))}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder="e.g. Saturday 10am to 2pm, or leave blank for closed"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium t2 mb-1.5">After-hours behaviour</p>
            <select
              value={afterHoursBehavior[client.id] ?? 'take_message'}
              onChange={e => setAfterHoursBehavior(prev => ({ ...prev, [client.id]: e.target.value }))}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="take_message">Take a message</option>
              <option value="route_emergency">Route emergencies to a phone number</option>
              <option value="custom_message">Custom message only</option>
            </select>
          </div>
          {afterHoursBehavior[client.id] === 'route_emergency' && (
            <div>
              <p className="text-[11px] font-medium t2 mb-1.5">Emergency phone number</p>
              <input
                type="tel"
                value={afterHoursPhone[client.id] ?? ''}
                onChange={e => setAfterHoursPhone(prev => ({ ...prev, [client.id]: e.target.value }))}
                className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                placeholder="e.g. +13065550101"
              />
            </div>
          )}
        </div>
      </div>
      </motion.div>

      {/* 8c — Section Editors */}
      {([
        { id: 'identity', label: 'Agent Identity', desc: 'Agent name, greeting, and personality', rows: 6 },
        { id: 'hours', label: 'Business Hours', desc: 'Hours your agent mentions to callers', rows: 3 },
        { id: 'knowledge', label: 'Knowledge Base', desc: 'Upload documents for your agent to search through — policies, procedures, or detailed guides.', rows: 10 },
      ] as const).map(({ id: sectionId, label, desc, rows }) => {
        const parsed = sectionContent[client.id] ?? {}
        const hasMarker = sectionId in parsed
        const collapsed = sectionCollapsed[client.id]?.[sectionId] ?? true
        const saving = sectionSaving[client.id]?.[sectionId] ?? false
        const saved = sectionSaved[client.id]?.[sectionId] ?? false
        const error = sectionError[client.id]?.[sectionId] ?? ''
        const value = parsed[sectionId] ?? ''
        return (
          <motion.div
            key={sectionId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.0 }}
          >
            <div className="rounded-2xl border b-theme bg-surface p-5">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setSectionCollapsed(prev => ({
                  ...prev,
                  [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: !collapsed },
                }))}
              >
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">{label}</p>
                  <p className="text-[11px] t3 mt-0.5">{desc}</p>
                </div>
                <svg
                  className={`w-4 h-4 t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!collapsed && (
                <div className="mt-4 space-y-3">
                  {!hasMarker && (
                    <p className="text-[10px] t3 italic">This section wasn&apos;t found in your prompt — saving will add it automatically.</p>
                  )}
                  <textarea
                    rows={rows}
                    className="w-full rounded-xl border b-theme bg-input px-3 py-2 text-[12px] t1 resize-y font-mono"
                    placeholder={`Enter ${label.toLowerCase()} content...`}
                    value={value}
                    onChange={e => setSectionContent(prev => ({
                      ...prev,
                      [client.id]: { ...(prev[client.id] ?? {}), [sectionId]: e.target.value },
                    }))}
                  />
                  {error && <p className="text-[11px] text-red-500">{error}</p>}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => saveSection(sectionId, value)}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-xl text-[11px] font-semibold bg-accent text-white disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
                    </button>
                    <p className="text-[10px] t3">Changes sync to your agent immediately.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}

      {/* 8b — Advanced Context */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Advanced Context</p>
            <p className="text-[11px] t3 mt-0.5">Extra knowledge injected at call time — not stored in the prompt</p>
          </div>
          <button
            onClick={saveAdvanced}
            disabled={advancedSaving}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              advancedSaved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-zinc-700 hover:bg-zinc-600 t1'
            } disabled:opacity-40`}
          >
            {advancedSaving ? 'Saving…' : advancedSaved ? '✓ Active on next call' : 'Save'}
          </button>
        </div>

        {/* Business Facts */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] t3 block">Business facts</label>
          <p className="text-[11px] t3">
            Core business info your agent always knows — hours, location, team members, services.
          </p>
          <textarea
            value={businessFacts[client.id] ?? ''}
            onChange={e => setBusinessFacts(prev => ({ ...prev, [client.id]: e.target.value }))}
            rows={4}
            className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
            placeholder="e.g. Parking is free out front. We're near the Walmart on 22nd St. Our lead tech is Ryan. Closed Christmas Day and Boxing Day."
          />
        </div>

        {/* Extra Q&A pairs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] t3 block">Extra Q&amp;A pairs</label>
              <p className="text-[11px] t3">Common questions and answers. Your agent uses these to answer caller questions directly.</p>
            </div>
            {(extraQA[client.id]?.length ?? 0) < 10 && (
              <button
                type="button"
                onClick={() => setExtraQA(prev => ({
                  ...prev,
                  [client.id]: [...(prev[client.id] ?? []), { q: '', a: '' }],
                }))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium t2 border b-theme hover:t1 hover:b-theme transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Add
              </button>
            )}
          </div>

          {(extraQA[client.id] ?? []).length === 0 && (
            <p className="text-[11px] t3 py-1">No Q&amp;A pairs yet — add up to 10.</p>
          )}

          <div className="space-y-2">
            {(extraQA[client.id] ?? []).map((pair, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                <input
                  type="text"
                  value={pair.q}
                  onChange={e => setExtraQA(prev => {
                    const updated = [...(prev[client.id] ?? [])]
                    updated[idx] = { ...updated[idx], q: e.target.value }
                    return { ...prev, [client.id]: updated }
                  })}
                  placeholder="Question…"
                  className="bg-black/20 border b-theme rounded-xl px-3 py-2 text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <input
                  type="text"
                  value={pair.a}
                  onChange={e => setExtraQA(prev => {
                    const updated = [...(prev[client.id] ?? [])]
                    updated[idx] = { ...updated[idx], a: e.target.value }
                    return { ...prev, [client.id]: updated }
                  })}
                  placeholder="Answer…"
                  className="bg-black/20 border b-theme rounded-xl px-3 py-2 text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setExtraQA(prev => ({
                    ...prev,
                    [client.id]: (prev[client.id] ?? []).filter((_, i) => i !== idx),
                  }))}
                  className="p-2 rounded-xl t3 hover:text-red-400 hover:bg-red-500/[0.07] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Context Data — REMOVED: duplicate of Context Data in AgentOverviewCard. State kept for saveAdvanced() compat. */}

        {/* Prompt Preview */}
        <div className="mt-5 pt-4 border-t b-theme">
          <button
            onClick={() => setPromptPreviewOpen(prev => !prev)}
            className="flex items-center gap-2 text-[11px] t3 hover:t2 transition-colors w-full"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="font-medium">Current system prompt</span>
            <span className="text-[10px] t3 ml-1">({(prompt[client.id] ?? '').length} chars — context data &amp; facts appended at call time)</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              className="ml-auto shrink-0 transition-transform duration-200"
              style={{ transform: promptPreviewOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <AnimatePresence initial={false}>
            {promptPreviewOpen && (
              <motion.div
                key="prompt-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <pre className="mt-3 p-4 rounded-xl bg-black/30 border b-theme text-[11px] t2 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed select-all">
                  {prompt[client.id] || 'No prompt configured'}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </motion.div>

  </>)
}
