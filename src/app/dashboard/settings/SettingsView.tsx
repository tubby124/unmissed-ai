'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from './page'
import ShimmerButton from '@/components/ui/shimmer-button'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import KnowledgeBaseTab from '@/components/dashboard/KnowledgeBaseTab'
import UsageSummary from '@/components/dashboard/UsageSummary'

interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string
  created_at: string
  is_active: boolean
}

type ImproveState = 'idle' | 'loading' | 'done' | 'error'

interface VoiceTabVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl: string
}

const TIMEZONES = [
  { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (LA)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'UTC', label: 'UTC' },
]

import { NICHE_CONFIG } from '@/lib/niche-config'

const KNOWN_VOICES: Record<string, string> = {
  'aa601962-1cbd-4bbd-9d96-3c7a93c3414a': 'Jacqueline',
  'd766b9e3-69df-4727-b62f-cd0b6772c2ad': 'Nour',
  '3bde8dc5-67c8-4e3f-82e1-b4f8e5c5db1c': 'Mark',
  'b9de4a89-7971-4ac8-aeea-d86fd8543a1a': 'Emily',
}

const RELOAD_OPTIONS = [
  { minutes: 100, price: 10 },
  { minutes: 200, price: 20 },
  { minutes: 300, price: 30 },
]

import { fmtPhone, timeAgo, getPlanName } from '@/lib/settings-utils'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium t3 border b-theme hover:t1 hover:b-theme transition-all shrink-0"
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  )
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
      <span className="text-xs t3 w-24 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono t2 truncate">{url}</span>
      <CopyButton value={url} />
    </div>
  )
}

function ConfigRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0">
      <span className="text-xs t3 w-32 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono t2 truncate">{value}</span>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}

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
  const [prompt, setPrompt] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.system_prompt ?? '']))
  )
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.status ?? 'active']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // God Mode — editable config fields (admin only)
  const [godConfig, setGodConfig] = useState<Record<string, {
    telegram_bot_token: string
    telegram_chat_id: string
    timezone: string
    twilio_number: string
    monthly_minute_limit: number
  }>>(() =>
    Object.fromEntries(clients.map(c => [c.id, {
      telegram_bot_token: '',  // never pre-fill secrets
      telegram_chat_id: c.telegram_chat_id ?? '',
      timezone: c.timezone ?? 'America/Edmonton',
      twilio_number: c.twilio_number ?? '',
      monthly_minute_limit: c.monthly_minute_limit ?? 500,
    }]))
  )
  const [godSaving, setGodSaving] = useState(false)
  const [godSaved, setGodSaved] = useState(false)
  const [telegramTest, setTelegramTest] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>(() =>
    Object.fromEntries(clients.map(c => [c.id, 'idle' as const]))
  )

  // Telegram style
  const [tgStyle, setTgStyle] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.telegram_style ?? 'standard']))
  )
  const [tgStyleSaving, setTgStyleSaving] = useState(false)

  // Re-generate from template
  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'done' | 'partial' | 'error'>('idle')

  // AI Improve Prompt
  const [improveState, setImproveState] = useState<ImproveState>('idle')
  const [improveResult, setImproveResult] = useState<{
    improved_prompt: string
    changes: Array<{ type: string; section: string; what: string; why: string; confidence: string }>
    call_count: number
    has_enough_data: boolean
  } | null>(null)
  const [improveError, setImproveError] = useState('')

  // Learning Loop
  type LearningStatus = {
    calls_since_last_analysis: number
    last_analyzed_at: string | null
    should_analyze: boolean
    trigger_reason: 'cadence' | 'friction_call' | 'unknown_status' | 'short_call' | 'frustrated' | null
    pending_report: {
      id: string
      recommendations_count: number
      top_recs: Array<{ title: string; rationale: string; priority: string }>
    } | null
  }
  const [learning, setLearning] = useState<LearningStatus | null>(null)
  const [learningState, setLearningState] = useState<'checking' | 'analyzing' | 'ready' | 'idle'>('checking')
  const [learningDismissed, setLearningDismissed] = useState(() => {
    try { return sessionStorage.getItem(`learning_dismissed_${selectedId}`) === '1' } catch { return false }
  })
  const dismissLearning = useCallback(() => {
    try { sessionStorage.setItem(`learning_dismissed_${selectedId}`, '1') } catch { /* ignore */ }
    setLearningDismissed(true)
  }, [selectedId])

  // Version History
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null)

  // Re-sync Agent
  const [syncing, setSyncing] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [syncError, setSyncError] = useState('')
  const [saveUltravoxWarning, setSaveUltravoxWarning] = useState<string | null>(null)

  // SMS Follow-up
  const [smsEnabled, setSmsEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.sms_enabled ?? false]))
  )
  const [smsTemplate, setSmsTemplate] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.sms_template ?? '']))
  )
  const [smsSaving, setSmsSaving] = useState(false)
  const [smsSaved, setSmsSaved] = useState(false)
  const [testSmsPhone, setTestSmsPhone] = useState('')
  const [testSmsState, setTestSmsState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [testSmsError, setTestSmsError] = useState('')

  // Right Now (injected_note)
  const [injectedNote, setInjectedNote] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.injected_note ?? '']))
  )
  const [injectedNoteSaving, setInjectedNoteSaving] = useState(false)
  const [injectedNoteSaved, setInjectedNoteSaved] = useState(false)

  // Advanced Context
  const [businessFacts, setBusinessFacts] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.business_facts ?? '']))
  )
  const [extraQA, setExtraQA] = useState<Record<string, { q: string; a: string }[]>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.extra_qa ?? []]))
  )
  const [advancedSaving, setAdvancedSaving] = useState(false)
  const [advancedSaved, setAdvancedSaved] = useState(false)
  const [contextData, setContextData] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data ?? '']))
  )
  const [contextDataLabel, setContextDataLabel] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data_label ?? '']))
  )
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false)

  // Booking / Calendar
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingSaved, setBookingSaved] = useState(false)
  const [bookingDuration, setBookingDuration] = useState<Record<string, number>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.booking_service_duration_minutes ?? 60]))
  )
  const [bookingBuffer, setBookingBuffer] = useState<Record<string, number>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.booking_buffer_minutes ?? 15]))
  )

  // Test Call
  const [testPhone, setTestPhone] = useState('')
  const [testCallState, setTestCallState] = useState<'idle' | 'calling' | 'done' | 'error'>('idle')
  const [testCallResult, setTestCallResult] = useState<{ callId?: string; twilio_sid?: string } | null>(null)
  const [testCallError, setTestCallError] = useState('')

  // Collapsible sections
  const [promptCollapsed, setPromptCollapsed] = useState(isAdmin)
  const [webhooksCollapsed, setWebhooksCollapsed] = useState(true)

  // Setup section
  const [forwardingNumber, setForwardingNumber] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.forwarding_number ?? '']))
  )
  const [setupComplete, setSetupComplete] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.setup_complete ?? false]))
  )
  const [setupCollapsed, setSetupCollapsed] = useState(() => {
    const c = (initialClientId && clients.find(c => c.id === initialClientId)) || clients[0]
    return !!(c?.setup_complete || c?.twilio_number)
  })
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupSaved, setSetupSaved] = useState(false)
  const [setupEditing, setSetupEditing] = useState(false)

  const [changeDesc, setChangeDesc] = useState('')
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'voice' | 'notifications' | 'billing' | 'knowledge'>('general')
  const [reloadMinutes, setReloadMinutes] = useState(100)
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadSuccess, setReloadSuccess] = useState<number | null>(null)

  // Voice tab state
  const [voices, setVoices] = useState<VoiceTabVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [])

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  function playVoice(vid: string, previewUrl: string) {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingVoiceId(vid)
    const url = previewUrl || `/api/dashboard/voices/${vid}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audio.play().catch(() => setPlayingVoiceId(null))
    audioRef.current = audio
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reloaded = params.get('reloaded')
    if (reloaded) {
      setReloadSuccess(parseInt(reloaded, 10))
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setReloadSuccess(null), 5000)
    }
  }, [])

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const voiceName = client.agent_voice_id ? (KNOWN_VOICES[client.agent_voice_id] ?? null) : null
  const minutesUsed = client.seconds_used_this_month != null ? Math.ceil(client.seconds_used_this_month / 60) : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? 500
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  const currentPrompt = prompt[client.id] ?? ''
  const originalPrompt = client.system_prompt ?? ''
  const dirty = currentPrompt !== originalPrompt
  const charCount = currentPrompt.length

  const inboundUrl = `${appUrl}/api/webhook/${client.slug}/inbound`
  const completedUrl = `${appUrl}/api/webhook/${client.slug}/completed`

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

  async function saveTelegramStyle(style: string) {
    setTgStyle(prev => ({ ...prev, [client.id]: style }))
    setTgStyleSaving(true)
    await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, telegram_style: style }),
    })
    setTgStyleSaving(false)
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

  const isActive = status[client.id] === 'active'

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

  async function saveSms() {
    setSmsSaving(true)
    setSmsSaved(false)
    const body: Record<string, unknown> = {
      sms_enabled: smsEnabled[client.id],
      sms_template: smsTemplate[client.id],
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSmsSaving(false)
    if (res.ok) {
      setSmsSaved(true)
      setTimeout(() => setSmsSaved(false), 3000)
    }
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

  async function saveInjectedNote(clearNote = false) {
    setInjectedNoteSaving(true)
    setInjectedNoteSaved(false)
    const note = clearNote ? null : (injectedNote[client.id] ?? '').trim() || null
    if (clearNote) setInjectedNote(prev => ({ ...prev, [client.id]: '' }))
    const body: Record<string, unknown> = { injected_note: note }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setInjectedNoteSaving(false)
    if (res.ok) {
      setInjectedNoteSaved(true)
      setTimeout(() => setInjectedNoteSaved(false), 3000)
    }
  }

  async function saveBookingConfig() {
    setBookingSaving(true)
    setBookingSaved(false)
    const body: Record<string, unknown> = {
      booking_service_duration_minutes: bookingDuration[client.id] ?? 60,
      booking_buffer_minutes: bookingBuffer[client.id] ?? 15,
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

  async function fireTestSms() {
    if (!testSmsPhone.trim()) return
    setTestSmsState('sending')
    setTestSmsError('')
    const body: Record<string, unknown> = { to_phone: testSmsPhone.trim() }
    if (isAdmin) body.client_id = client.id
    try {
      const res = await fetch('/api/dashboard/settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setTestSmsState('done')
        setTimeout(() => setTestSmsState('idle'), 4000)
      } else {
        setTestSmsState('error')
        setTestSmsError(data.error || 'Send failed — check Twilio config.')
      }
    } catch {
      setTestSmsState('error')
      setTestSmsError('Network error')
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
          ] as { id: typeof activeTab; label: string; adminOnly: boolean; icon: string }[])
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

      {/* ─── General Tab ──────────────────────────────────────────────── */}
      {activeTab === 'general' && (<>

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
                {isAdmin
                  ? <span className="text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Beta</span>
                  : <span className="text-[9px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Coming Soon</span>
                }
              </label>
              <input
                type="tel"
                disabled={!isAdmin}
                value={forwardingNumber[client.id] ?? ''}
                onChange={(e) => setForwardingNumber(prev => ({ ...prev, [client.id]: e.target.value }))}
                placeholder="+1 (555) 555-5555"
                className={`w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 ${!isAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
              />
              <p className="text-[11px] t3 mt-1">
                {isAdmin
                  ? 'Enter your personal phone number. When a caller asks for a human, they\'ll be transferred here.'
                  : 'Live call transfer to your number — coming soon.'
                }
              </p>
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
                  ? 'Tap to view and edit what your AI agent says on calls'
                  : `${nicheConfig.label} agent instructions`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {promptCollapsed && (
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
                    {isAdmin && (
                      <ShimmerButton
                        onClick={async () => {
                          setRegenState('loading')
                          try {
                            const res = await fetch('/api/dashboard/regenerate-prompt', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ clientId: selectedId }),
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
                    )}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* 6 — AI Improve Prompt (Beta) */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5">
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
      </div>

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
                      {!v.is_active && (
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

      </>)}

      {/* ─── SMS Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'sms' && (<>

      {/* SMS Follow-up */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">SMS Follow-up</p>
            <p className="text-[11px] t3 mt-0.5">Sent to the caller after each call ends.</p>
          </div>
          <button
            onClick={saveSms}
            disabled={smsSaving || !client.twilio_number}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              smsSaved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            } disabled:opacity-40`}
          >
            {smsSaving ? 'Saving…' : smsSaved ? '✓ Saved' : 'Save SMS Config'}
          </button>
        </div>

        {/* No Twilio number warning */}
        {!client.twilio_number && (
          <div className="flex items-center gap-2.5 mt-3 px-3.5 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-amber-400/90">SMS requires a phone number. Contact support to add one.</span>
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center gap-3 py-3 border-b b-theme">
          <button
            onClick={() => setSmsEnabled(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
            disabled={!client.twilio_number}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${smsEnabled[client.id] ? 'bg-blue-500' : 'bg-zinc-700'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${smsEnabled[client.id] ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-xs t2">
            {!client.twilio_number
              ? 'SMS unavailable — no phone number assigned'
              : smsEnabled[client.id] ? 'Auto-send SMS after each call' : 'SMS disabled — callers will not receive a follow-up text'}
          </span>
        </div>

        {/* Template editor */}
        <div className="mt-3">
          <label className="text-[11px] t3 block mb-1.5">Message Template</label>
          <textarea
            value={smsTemplate[client.id] ?? ''}
            onChange={e => setSmsTemplate(prev => ({ ...prev, [client.id]: e.target.value }))}
            disabled={!smsEnabled[client.id] || !client.twilio_number}
            rows={3}
            className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            placeholder="Thanks for calling {{business}}! We'll follow up shortly."
          />
          <p className="text-[10px] t3 mt-1">
            Placeholders: <span className="font-mono t3">{'{{business}}'}</span> = business name &nbsp;·&nbsp; <span className="font-mono t3">{'{{summary}}'}</span> = call summary excerpt
          </p>
        </div>

        {/* Live preview */}
        {smsTemplate[client.id] && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-surface border b-theme">
            <p className="text-[10px] font-semibold t3 uppercase tracking-wider mb-1">Preview</p>
            <p className="text-xs t2 leading-relaxed whitespace-pre-wrap">
              {(smsTemplate[client.id] ?? '')
                .replace(/\{\{business\}\}/g, client.business_name || '')
                .replace(/\{\{summary\}\}/g, '[call summary]')}
            </p>
          </div>
        )}

        {/* Test SMS */}
        <div className="mt-4 pt-4 border-t b-theme">
          <p className="text-[11px] t3 mb-2">Send a test SMS to verify delivery</p>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={testSmsPhone}
              onChange={e => setTestSmsPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fireTestSms()}
              placeholder="+14031234567"
              disabled={testSmsState === 'sending'}
              className="flex-1 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
            />
            <button
              onClick={fireTestSms}
              disabled={!testSmsPhone.trim() || testSmsState === 'sending' || !smsTemplate[client.id] || !client.twilio_number}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 t1 transition-all disabled:opacity-40 shrink-0"
            >
              {testSmsState === 'sending' ? 'Sending…' : 'Send Test'}
            </button>
          </div>

          {testSmsState === 'done' && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/[0.07] border border-green-500/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[11px] text-green-400/90">SMS sent to {testSmsPhone}</span>
            </div>
          )}

          {testSmsState === 'error' && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/[0.07] border border-red-500/20">
              <span className="text-[11px] text-red-400/90 flex-1">{testSmsError}</span>
              <button
                onClick={() => setTestSmsState('idle')}
                className="text-[10px] t3 hover:t2"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
      </motion.div>

      </>)}

      {/* ─── General Tab (continued) ──────────────────────────────── */}
      {activeTab === 'general' && (<>

      {/* 8a — Right Now (injected_note) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
      >
      <div className={`rounded-2xl border p-5 ${injectedNote[client.id] ? 'border-amber-500/40 bg-amber-500/[0.04]' : 'b-theme bg-surface'}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Right Now</p>
              {injectedNote[client.id] && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">ACTIVE</span>
              )}
            </div>
            <p className="text-[11px] t3 mt-0.5">Inject a time-sensitive note into your agent&apos;s active prompt — no redeploy needed</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {injectedNote[client.id] && (
              <button
                onClick={() => saveInjectedNote(true)}
                disabled={injectedNoteSaving}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold t3 hover:text-red-400 border b-theme hover:border-red-500/30 transition-all disabled:opacity-40"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => saveInjectedNote(false)}
              disabled={injectedNoteSaving}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                injectedNoteSaved
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
              } disabled:opacity-40`}
            >
              {injectedNoteSaving ? 'Saving…' : injectedNoteSaved ? '✓ Live' : 'Push Live'}
            </button>
          </div>
        </div>
        <textarea
          value={injectedNote[client.id] ?? ''}
          onChange={e => setInjectedNote(prev => ({ ...prev, [client.id]: e.target.value }))}
          rows={3}
          className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 resize-none focus:outline-none focus:border-amber-500/40 transition-colors placeholder:t3"
          placeholder="e.g. We're closed this Saturday. The owner is traveling and unavailable until Monday. All urgent requests go to Ryan at 306-555-0101."
        />
        <p className="text-[10px] t3 mt-1.5">This note is appended to your active prompt immediately. Clear it when it&apos;s no longer relevant.</p>
      </div>
      </motion.div>

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
            <p className="text-[11px] t3 mt-0.5">Extra knowledge injected into your agent&apos;s prompt</p>
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
            {advancedSaving ? 'Saving…' : advancedSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>

        {/* Business Facts */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] t3 block">Business facts</label>
          <p className="text-[10px] t3">
            Anything your agent should always know — hours exceptions, parking, nearby landmarks, key staff names
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
              <p className="text-[10px] t3">Common caller questions not covered in the wizard</p>
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

        {/* Context Data */}
        <div className="space-y-1.5 mt-5">
          <label className="text-[11px] t3 block">Context data label</label>
          <input
            type="text"
            value={contextDataLabel[client.id] ?? ''}
            onChange={e => setContextDataLabel(prev => ({ ...prev, [client.id]: e.target.value }))}
            placeholder="e.g. Menu, Price List, Service Catalog"
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-blue-500/40 transition-colors"
          />
          <label className="text-[11px] t3 block mt-3">Context data</label>
          <p className="text-[10px] t3">
            Structured text your agent can reference during calls -- service menus, price lists, inventory notes
          </p>
          <textarea
            value={contextData[client.id] ?? ''}
            onChange={e => setContextData(prev => ({ ...prev, [client.id]: e.target.value }))}
            rows={5}
            className="w-full bg-black/20 border b-theme rounded-xl p-3 text-sm t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
            placeholder="e.g. Windshield replacement: $250-$400&#10;Chip repair: $60-$80&#10;ADAS calibration: $150"
          />
        </div>

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
            <span className="text-[10px] t3 ml-1">({(client.system_prompt ?? '').length} chars)</span>
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
                  {client.system_prompt || 'No prompt configured'}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </motion.div>

      {/* 9 — Test Call */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.06 }}
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

      </>)}

      {/* ─── Voice Tab ────────────────────────────────────────────── */}
      {activeTab === 'voice' && (() => {
        const voiceId = client.agent_voice_id ?? ''
        const currentVoice = voices.find(v => v.voiceId === voiceId)
        return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
            className="space-y-4"
          >
            {/* Current voice card */}
            <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
              <div className="p-5 border-b b-theme">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Current Voice</p>
                <p className="text-[11px] t3">The voice your callers hear when they reach your agent.</p>
              </div>

              <div className="p-5">
                {voicesLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-28 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-44 rounded bg-white/[0.04] animate-pulse" />
                    </div>
                  </div>
                ) : currentVoice ? (
                  <div className="flex items-center gap-4">
                    {/* Avatar + play */}
                    <button
                      onClick={() => {
                        if (playingVoiceId === currentVoice.voiceId) {
                          audioRef.current?.pause()
                          setPlayingVoiceId(null)
                        } else {
                          playVoice(currentVoice.voiceId, currentVoice.previewUrl)
                        }
                      }}
                      className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 group cursor-pointer transition-all hover:border-indigo-400/50 hover:shadow-[0_0_16px_rgba(99,102,241,0.15)]"
                    >
                      {playingVoiceId === currentVoice.voiceId ? (
                        <div className="flex items-center gap-[3px]">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="w-[3px] rounded-full bg-indigo-400 animate-pulse" style={{ height: `${10 + i * 4}px`, animationDelay: `${i * 150}ms` }} />
                          ))}
                        </div>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400 ml-0.5 group-hover:text-indigo-300 transition-colors">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>

                    {/* Voice info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <p className="text-sm font-semibold t1 truncate">{currentVoice.name}</p>
                        <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          currentVoice.provider === 'Cartesia' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                          : currentVoice.provider === 'Eleven Labs' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        }`}>
                          {currentVoice.provider}
                        </span>
                      </div>
                      <p className="text-[11px] t3 leading-relaxed line-clamp-2">{currentVoice.description || 'No description available'}</p>
                    </div>
                  </div>
                ) : voiceId ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/[0.04] border b-theme flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="t3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.5"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium t2">Custom Voice</p>
                      <p className="text-[10px] font-mono t3 truncate max-w-[200px]">{voiceId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
                      <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] text-amber-400/90">No voice selected yet. Browse the Voice Library to choose one.</span>
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="px-5 py-3 border-t b-theme bg-white/[0.01] flex items-center justify-between">
                <p className="text-[10px] t3">
                  {playingVoiceId === currentVoice?.voiceId ? 'Playing preview...' : 'Click the avatar to hear a preview'}
                </p>
                <a
                  href="/dashboard/voices"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors duration-200"
                >
                  Browse Voice Library
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
            </div>

            {/* Voice tips card */}
            <div className="rounded-2xl border b-theme bg-surface p-5">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Voice Tips</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z', title: 'Match your brand', desc: 'Choose a voice that reflects your business personality and caller expectations.' },
                  { icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', title: 'Test with callers', desc: 'Make a few test calls after switching to ensure the voice feels natural.' },
                  { icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14', title: 'Switch anytime', desc: 'You can change your agent\'s voice as often as you\'d like from the library.' },
                ].map(tip => (
                  <div key={tip.title} className="p-3 rounded-xl bg-white/[0.02] border b-theme">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-indigo-400/70 mb-2">
                      <path d={tip.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-xs font-semibold t1 mb-0.5">{tip.title}</p>
                    <p className="text-[10px] t3 leading-relaxed">{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )
      })()}

      {/* ─── Alerts Tab ────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
          className="space-y-4"
        >

        {/* Telegram connection status card */}
        <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
          <div className="p-5 border-b b-theme">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Alert Channels</p>
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
                  : 'b-theme bg-white/[0.01]'
              }`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    client.telegram_bot_token && client.telegram_chat_id
                      ? 'bg-blue-500/15'
                      : 'bg-white/[0.04]'
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

              {/* SMS — coming soon */}
              <div className="p-4 rounded-xl border b-theme bg-white/[0.01] opacity-60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold t1">SMS Alerts</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] t3">Coming soon</span>
                  </div>
                </div>
                <p className="text-[10px] t3 leading-relaxed">Receive text alerts for hot leads and missed calls.</p>
              </div>

              {/* Email — coming soon */}
              <div className="p-4 rounded-xl border b-theme bg-white/[0.01] opacity-60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
                      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold t1">Email</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] t3">Coming soon</span>
                  </div>
                </div>
                <p className="text-[10px] t3 leading-relaxed">Daily digest and critical alerts delivered to your inbox.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Message Style — only when connected */}
        {client.telegram_bot_token && client.telegram_chat_id && (
          <div className="rounded-2xl border b-theme bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Message Style</p>
                <p className="text-[11px] t3">Choose how call summaries appear in your Telegram chat.</p>
              </div>
              {tgStyleSaving && (
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
                  onClick={() => saveTelegramStyle(opt.id)}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer group ${
                    tgStyle[client.id] === opt.id
                      ? 'border-blue-500/40 bg-blue-500/[0.08] shadow-[0_0_12px_rgba(59,130,246,0.06)]'
                      : 'b-theme bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      tgStyle[client.id] === opt.id ? 'bg-blue-500/15' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'
                    }`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={tgStyle[client.id] === opt.id ? 'text-blue-400' : 't3'}>
                        <path d={opt.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className={`text-xs font-semibold transition-colors ${tgStyle[client.id] === opt.id ? 'text-blue-400' : 't1'}`}>{opt.label}</p>
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
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-1">Notification Preferences</p>
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
                            <span className="text-[8px] font-semibold px-1 py-px rounded bg-white/[0.06] t3">Soon</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
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
                                  : 'bg-white/[0.06] opacity-40'
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

        </motion.div>
      )}

      {/* ─── Billing Tab ──────────────────────────────────────────── */}
      {activeTab === 'billing' && (() => {
        const now = new Date()
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const planName = getPlanName(client.monthly_minute_limit)

        return (
          <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
            {/* Past-due warning banner */}
            {client.subscription_status === 'past_due' && (
              <div className="border-b border-red-500/30 bg-red-500/[0.06] p-4">
                <p className="text-xs font-medium text-red-400">
                  Payment failed — your agent will pause on {fmtDate(client.grace_period_end)}.
                  Please update your payment method.
                </p>
              </div>
            )}

            {/* Section A: Your Plan */}
            <div className="p-5 border-b b-theme">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Your Plan</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold t1">{planName}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                  {minuteLimit} min/mo
                </span>
                {(client.bonus_minutes ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                    + {client.bonus_minutes} bonus
                  </span>
                )}
              </div>
              <p className="text-[11px] t3 mt-2">
                {client.subscription_status === 'trialing'
                  ? `Free trial — $10/mo starts on ${fmtDate(client.subscription_current_period_end)}`
                  : client.subscription_status === 'active'
                    ? `Active — $10/mo. Renews ${fmtDate(client.subscription_current_period_end)}`
                    : client.subscription_status === 'past_due'
                      ? `Payment failed — update your payment method or your agent will pause on ${fmtDate(client.grace_period_end)}`
                      : client.subscription_status === 'canceled'
                        ? 'No active subscription'
                        : `${minuteLimit} minutes included per month. Reload anytime below.`}
              </p>
            </div>

            {/* Section B: Usage This Cycle */}
            <div className="p-5 border-b b-theme">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Usage This Cycle</p>
                <span className="text-xs font-mono t2 tabular-nums">
                  {minutesUsed} / {totalAvailable} min
                </span>
              </div>
              <div className="h-1.5 bg-hover rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePct > 100 ? 'bg-pink-500' : usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usagePct, 100)}%` }}
                />
              </div>
              {usagePct > 100 ? (
                  <p className="text-[11px] mt-2 text-amber-400">
                    You&apos;ve used all {totalAvailable} free minutes. Buy more below to keep your agent running.
                  </p>
              ) : (
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px] t3">{fmtDate(cycleStart.toISOString())} &rarr; {fmtDate(cycleEnd.toISOString())}</p>
                  <p className="text-[11px] t3 tabular-nums font-mono">
                    {totalAvailable - minutesUsed} min remaining
                  </p>
                </div>
              )}
            </div>

            {/* Section C: Buy Minutes */}
            <div className="p-5 border-b b-theme">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Buy Minutes</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {RELOAD_OPTIONS.map(opt => (
                  <button
                    key={opt.minutes}
                    onClick={() => setReloadMinutes(opt.minutes)}
                    className={`rounded-lg border p-3 text-center transition-all cursor-pointer ${
                      reloadMinutes === opt.minutes
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'b-theme hover:bg-hover'
                    }`}
                  >
                    <p className="text-sm font-semibold t1">{opt.minutes} min</p>
                    <p className="text-xs t3 mt-0.5">${opt.price} CAD</p>
                  </button>
                ))}
              </div>
              <button
                disabled={reloadLoading}
                onClick={async () => {
                  setReloadLoading(true)
                  try {
                    const body: Record<string, unknown> = { minutes: reloadMinutes }
                    if (isAdmin) body.client_id = client.id
                    const res = await fetch('/api/stripe/create-reload-checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })
                    const data = await res.json()
                    if (data.url) {
                      window.location.href = data.url
                    } else {
                      setReloadLoading(false)
                    }
                  } catch {
                    setReloadLoading(false)
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                {reloadLoading ? 'Redirecting...' : `Reload ${reloadMinutes} min — $${reloadMinutes / 10}`}
              </button>
            </div>

            {/* Section D: Account */}
            <div className="p-5">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Account</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs t3">Joined</span>
                  <span className="text-xs t2 font-mono">{fmtDate(client.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs t3">Current cycle</span>
                  <span className="text-xs t2 font-mono">{fmtDate(cycleStart.toISOString())} &ndash; {fmtDate(cycleEnd.toISOString())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs t3">Next renewal</span>
                  <span className="text-xs t2 font-mono">{fmtDate(client.subscription_current_period_end ?? cycleEnd.toISOString())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs t3">Setup fee</span>
                  <span className="text-xs t2 font-mono">$25 (paid)</span>
                </div>
              </div>
              <p className="text-[11px] t3 mt-4">
                To manage your subscription, email{' '}
                <span className="font-mono t2">support@unmissed.ai</span>
              </p>
            </div>

            {/* Admin: Ultravox account-level usage */}
            {isAdmin && <UsageSummary isAdmin={isAdmin} />}
          </div>
        )
      })()}

      {/* ─── Knowledge Tab ──────────────────────────────────────────── */}
      {activeTab === 'knowledge' && (
        <motion.div
          key="knowledge"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <KnowledgeBaseTab clientId={client.id} isAdmin={isAdmin} />
        </motion.div>
      )}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
