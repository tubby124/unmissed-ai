'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from './page'
import BorderBeam from '@/components/ui/border-beam'
import ShimmerButton from '@/components/ui/shimmer-button'

interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string
  created_at: string
  is_active: boolean
}

type ImproveState = 'idle' | 'loading' | 'done' | 'error'

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

function getPlanName(limit: number | null) {
  if (!limit || limit <= 50) return 'Free'
  if (limit <= 200) return 'Starter'
  if (limit <= 500) return 'Growth'
  return 'Scale'
}

const RELOAD_OPTIONS = [
  { minutes: 100, price: 10 },
  { minutes: 200, price: 20 },
  { minutes: 300, price: 30 },
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return p
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor(diff / 3600000)
  if (days > 30) return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  return 'Just now'
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

// ── CSV upload utilities ──────────────────────────────────────────────────────

function parseCsvRaw(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  function parseRow(line: string): string[] {
    const cells: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) { cells.push(cur.trim()); cur = '' }
      else cur += c
    }
    cells.push(cur.trim())
    return cells
  }
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) }
}

function detectKeyColumns(headers: string[]): string[] {
  const key = headers.filter(h =>
    /unit|suite|apt|apartment|door/i.test(h) ||
    /address|addr|street|property/i.test(h) ||
    /name|tenant|resident|renter|owner/i.test(h) ||
    /phone|tel|mobile|cell|contact/i.test(h) ||
    /status|active|lease|vacant/i.test(h)
  )
  return key.length > 0 ? key : headers.slice(0, Math.min(headers.length, 5))
}

function columnsToMarkdownTable(headers: string[], selectedCols: string[], rows: string[][]): string {
  const colIndices = selectedCols.map(c => headers.indexOf(c)).filter(i => i >= 0)
  const selHeaders = colIndices.map(i => headers[i])
  const divider = selHeaders.map(() => '---')
  const dataRows = rows.map(row => colIndices.map(i => row[i] ?? ''))
  return [selHeaders, divider, ...dataRows].map(row => '| ' + row.join(' | ') + ' |').join('\n')
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

  // Re-generate from template
  const [regenState, setRegenState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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

  // Advanced Context
  const [businessFacts, setBusinessFacts] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.business_facts ?? '']))
  )
  const [extraQA, setExtraQA] = useState<Record<string, { q: string; a: string }[]>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.extra_qa ?? []]))
  )
  const [advancedSaving, setAdvancedSaving] = useState(false)
  const [advancedSaved, setAdvancedSaved] = useState(false)

  // Context Data
  const [contextData, setContextData] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data ?? '']))
  )
  const [contextDataLabel, setContextDataLabel] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.context_data_label ?? '']))
  )
  const [contextDataSaving, setContextDataSaving] = useState(false)
  const [contextDataSaved, setContextDataSaved] = useState(false)
  const [csvUpload, setCsvUpload] = useState<Record<string, {
    allColumns: string[]
    allRows: string[][]
    selectedColumns: string[]
    rowCount: number
    truncated: boolean
  }>>({})
  const csvInputRef = useRef<HTMLInputElement>(null)

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
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupSaved, setSetupSaved] = useState(false)
  const [setupEditing, setSetupEditing] = useState(false)

  // Agent Name
  const [agentName, setAgentName] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.agent_name ?? '']))
  )
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [changeDesc, setChangeDesc] = useState('')
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'transfer' | 'sms' | 'voice' | 'notifications' | 'billing'>('general')
  const [reloadMinutes, setReloadMinutes] = useState(100)
  const [reloadLoading, setReloadLoading] = useState(false)
  const [reloadSuccess, setReloadSuccess] = useState<number | null>(null)

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
  const minutesUsed = client.minutes_used_this_month ?? 0
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

  async function saveContextData() {
    setContextDataSaving(true)
    setContextDataSaved(false)
    const body: Record<string, unknown> = {
      context_data: contextData[client.id] ?? '',
      context_data_label: contextDataLabel[client.id] ?? '',
    }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setContextDataSaving(false)
    if (res.ok) {
      setContextDataSaved(true)
      setTimeout(() => setContextDataSaved(false), 3000)
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsvRaw(text)
      if (headers.length === 0) return
      const MAX_ROWS = 250
      const truncated = rows.length > MAX_ROWS
      const limitedRows = truncated ? rows.slice(0, MAX_ROWS) : rows
      const selected = detectKeyColumns(headers)
      const clientId = csvInputRef.current?.dataset.clientid ?? ''
      setCsvUpload(prev => ({
        ...prev,
        [clientId]: { allColumns: headers, allRows: limitedRows, selectedColumns: selected, rowCount: rows.length, truncated },
      }))
    }
    reader.readAsText(file)
    e.target.value = ''
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
          <div className="flex flex-wrap gap-1 p-3">
            {clients.map(c => {
              const n = c.niche ?? ''
              const nc = NICHE_CONFIG[n] ?? { label: n || 'General', color: 't2', border: 'border-zinc-500/30' }
              const isSelected = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    if (!prompt[c.id]) setPrompt(prev => ({ ...prev, [c.id]: c.system_prompt ?? '' }))
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isSelected
                      ? `bg-blue-500/10 text-blue-300 border-blue-500/30`
                      : 't2 b-theme hover:t1 hover:bg-hover'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(c.status ?? 'active') === 'active' ? 'bg-green-500' : 'bg-zinc-600'}`} />
                  {c.business_name}
                  {n && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${isSelected ? 'text-blue-400/70' : nc.color + '/60'}`}>
                      {nc.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Tab bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:b-theme">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Settings tabs">
          {([
            { id: 'general',       label: 'Agent',    adminOnly: false },
            { id: 'transfer',      label: 'Transfer', adminOnly: true  },
            { id: 'sms',           label: 'SMS',      adminOnly: false },
            { id: 'voice',         label: 'Voice',    adminOnly: true  },
            { id: 'notifications', label: 'Alerts',   adminOnly: false },
            { id: 'billing',       label: 'Billing',  adminOnly: false },
          ] as { id: typeof activeTab; label: string; adminOnly: boolean }[])
            .filter(t => !t.adminOnly || isAdmin)
            .map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative pb-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                activeTab === id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:t2 dark:hover:t1'
              }`}
            >
              {label}
              {activeTab === id && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
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
          <div className="px-5 py-3 border-b border-amber-500/20 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-400">Start here — complete your setup</p>
          </div>
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
      <div className="relative rounded-2xl border b-theme bg-surface p-5 overflow-hidden">
        {client.status === 'active' && <BorderBeam size={250} duration={12} colorFrom="#6366f1" colorTo="#a855f7" />}
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-4">Agent overview</p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold t1">{client.business_name}</h2>
              {niche && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${nicheConfig.color} ${nicheConfig.border} bg-transparent`}>
                  {nicheConfig.label}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                {getPlanName(client.monthly_minute_limit)} · {minuteLimit} min/mo
                {(client.bonus_minutes ?? 0) > 0 && ` + ${client.bonus_minutes} bonus`}
              </span>
            </div>
            {/* Agent Name — inline edit */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] t3 uppercase tracking-wider">Agent</span>
              <input
                type="text"
                value={agentName[client.id] ?? ''}
                onChange={e => setAgentName(prev => ({ ...prev, [client.id]: e.target.value }))}
                placeholder="e.g. Aisha"
                className="text-xs t2 bg-hover px-2 py-0.5 rounded border b-theme w-28 focus:outline-none focus:border-blue-500/50"
              />
              {(agentName[client.id] ?? '') !== (client.agent_name ?? '') && (
                <button
                  disabled={nameSaving}
                  onClick={async () => {
                    setNameSaving(true)
                    setNameSaved(false)
                    const body: Record<string, unknown> = { agent_name: agentName[client.id]?.trim() }
                    if (isAdmin) body.client_id = client.id
                    const res = await fetch('/api/dashboard/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })
                    setNameSaving(false)
                    if (res.ok) {
                      setNameSaved(true)
                      client.agent_name = agentName[client.id]?.trim() ?? null
                      setTimeout(() => setNameSaved(false), 3000)
                    }
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                >
                  {nameSaving ? 'Saving...' : 'Save'}
                </button>
              )}
              {nameSaved && <span className="text-[10px] text-green-400">Saved</span>}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {voiceName && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] t3 uppercase tracking-wider">Voice</span>
                  <span className="text-xs t2 bg-hover px-2 py-0.5 rounded border b-theme">{voiceName}</span>
                </div>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] t3 uppercase tracking-wider">Slug</span>
                  <span className="text-xs font-mono t2 bg-hover px-2 py-0.5 rounded border b-theme">
                    {client.slug}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] t3 uppercase tracking-wider">Last updated</span>
                <span className="text-xs t3 font-mono">{timeAgo(client.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={toggleStatus}
              className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className={`text-[11px] font-medium ${isActive ? 'text-green-400' : 't3'}`}>
                {isActive ? 'Answering calls' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        {/* Usage bar — inline */}
        <div className="mt-4 pt-4 border-t b-theme">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Minutes This Month</p>
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
                You&apos;ve used all {totalAvailable} free minutes. Go to Billing &rarr; Buy Minutes to reload.
              </p>
          ) : (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] t3">Resets 1st of each month</p>
              <p className="text-[11px] t3 tabular-nums font-mono">
                {totalAvailable - minutesUsed} min remaining
              </p>
            </div>
          )}
        </div>
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

      {/* 4b — Context Data */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.18 }}
      >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <input
          type="file"
          accept=".csv"
          className="hidden"
          ref={csvInputRef}
          onChange={handleCsvUpload}
        />
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Context Data</p>
            <p className="text-[11px] t3 mt-0.5">Injected into every call. Use for tenant lists, menus, service catalogs, or FAQ data.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (csvInputRef.current) {
                  csvInputRef.current.dataset.clientid = client.id
                  csvInputRef.current.click()
                }
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border b-theme t2 hover:t1 transition-all"
            >
              Upload CSV
            </button>
            <button
              onClick={saveContextData}
              disabled={contextDataSaving}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                contextDataSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-blue-500 hover:bg-blue-400 text-white'
              } disabled:opacity-40`}
            >
              {contextDataSaving ? 'Saving…' : contextDataSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Column picker — shown after CSV upload, before confirm */}
        {csvUpload[client.id] && (
          <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold t1">
                {csvUpload[client.id].rowCount} rows detected
                {csvUpload[client.id].truncated && (
                  <span className="ml-2 text-[10px] text-amber-400/80 font-normal">
                    (first 250 will be used)
                  </span>
                )}
                {' '}— select columns to include:
              </p>
              <button
                onClick={() => setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })}
                className="text-[10px] t3 hover:t1"
              >
                Cancel
              </button>
            </div>

            {/* Column checkboxes */}
            <div className="flex flex-wrap gap-2">
              {csvUpload[client.id].allColumns.map(col => {
                const checked = csvUpload[client.id].selectedColumns.includes(col)
                return (
                  <label
                    key={col}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
                      checked ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'b-theme t3 hover:t2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="hidden"
                      onChange={() => setCsvUpload(prev => {
                        const curr = prev[client.id]
                        const selected = checked
                          ? curr.selectedColumns.filter(c => c !== col)
                          : [...curr.selectedColumns, col]
                        return { ...prev, [client.id]: { ...curr, selectedColumns: selected } }
                      })}
                    />
                    {col}
                  </label>
                )
              })}
            </div>

            {/* Warning: no address/unit column */}
            {csvUpload[client.id].selectedColumns.length > 0 &&
              !csvUpload[client.id].selectedColumns.some(c => /unit|address|addr|suite|apt|door|property/i.test(c)) && (
              <p className="text-[11px] text-amber-400/80">
                No unit or address column selected — address lookup may be less accurate.
              </p>
            )}

            {/* Row preview */}
            {csvUpload[client.id].selectedColumns.length > 0 && csvUpload[client.id].allRows.length > 0 && (
              <div>
                <p className="text-[10px] t3 mb-1.5">Preview (first 3 rows):</p>
                <div className="overflow-x-auto rounded-lg border b-theme">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b b-theme">
                        {csvUpload[client.id].selectedColumns.map(col => (
                          <th key={col} className="px-2 py-1 text-left text-[10px] font-semibold t3 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvUpload[client.id].allRows.slice(0, 3).map((row, ri) => (
                        <tr key={ri} className="border-b b-theme last:border-0">
                          {csvUpload[client.id].selectedColumns.map((col, ci) => {
                            const colIdx = csvUpload[client.id].allColumns.indexOf(col)
                            return (
                              <td key={ci} className="px-2 py-1 text-[10px] font-mono t2 max-w-36 truncate">
                                {row[colIdx] ?? ''}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })}
                className="px-3 py-1.5 rounded-lg text-xs t3 hover:t1 border b-theme transition-all"
              >
                Cancel
              </button>
              <button
                disabled={csvUpload[client.id].selectedColumns.length === 0}
                onClick={() => {
                  const state = csvUpload[client.id]
                  const markdown = columnsToMarkdownTable(state.allColumns, state.selectedColumns, state.allRows)
                  setContextData(prev => ({ ...prev, [client.id]: markdown }))
                  if (!contextDataLabel[client.id]) {
                    setContextDataLabel(prev => ({ ...prev, [client.id]: 'Tenant List' }))
                  }
                  setCsvUpload(prev => { const c = { ...prev }; delete c[client.id]; return c })
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-40 transition-all"
              >
                Use This Data →
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 mt-4">
          <div>
            <label className="text-[11px] t3 block mb-1">Data label <span className="t3">(e.g. "Tenant List", "Menu", "Price Sheet")</span></label>
            <input
              type="text"
              value={contextDataLabel[client.id] ?? ''}
              onChange={e => setContextDataLabel(prev => ({ ...prev, [client.id]: e.target.value }))}
              placeholder="Tenant List"
              className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="text-[11px] t3 block mb-1">Data <span className="t3">(paste or upload CSV — max ~32,000 chars)</span></label>
            <textarea
              value={contextData[client.id] ?? ''}
              onChange={e => setContextData(prev => ({ ...prev, [client.id]: e.target.value }))}
              placeholder={`Unit, Tenant, Rent\n4A, John Smith, $1200\n4B, Sarah Lee, $1350`}
              className="w-full h-40 bg-black/20 border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
              maxLength={32000}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] t3">{(contextData[client.id] ?? '').length.toLocaleString()} / 32,000 chars</p>
              {(contextData[client.id] ?? '').startsWith('|') && (
                <p className="text-[10px] text-green-400/70">Lookup instructions auto-injected on every call</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </motion.div>

      {/* 4c — Booking (calendar_beta_enabled or admin only) */}
      {(client.calendar_beta_enabled || isAdmin) && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-emerald-400/80">Booking</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">Beta</span>
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
                            setRegenState('done')
                            setTimeout(() => setRegenState('idle'), 3000)
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
                        {regenState === 'loading' ? 'Re-generating…' : regenState === 'done' ? 'Done!' : regenState === 'error' ? 'Error — try again' : 'Re-generate from template'}
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
            disabled={smsSaving}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              smsSaved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            } disabled:opacity-40`}
          >
            {smsSaving ? 'Saving…' : smsSaved ? '✓ Saved' : 'Save SMS Config'}
          </button>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-3 py-3 border-b b-theme">
          <button
            onClick={() => setSmsEnabled(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${smsEnabled[client.id] ? 'bg-blue-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${smsEnabled[client.id] ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-xs t2">
            {smsEnabled[client.id] ? 'Auto-send SMS after each call' : 'SMS disabled — callers will not receive a follow-up text'}
          </span>
        </div>

        {/* Template editor */}
        <div className="mt-3">
          <label className="text-[11px] t3 block mb-1.5">Message Template</label>
          <textarea
            value={smsTemplate[client.id] ?? ''}
            onChange={e => setSmsTemplate(prev => ({ ...prev, [client.id]: e.target.value }))}
            disabled={!smsEnabled[client.id]}
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
              disabled={!testSmsPhone.trim() || testSmsState === 'sending' || !smsTemplate[client.id]}
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

      {/* ─── Transfer Tab ─────────────────────────────────────────── */}
      {activeTab === 'transfer' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
        >
        <div className="rounded-2xl border border-gray-200 dark:b-theme bg-white dark:bg-surface p-5">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500 dark:t3 mb-1">Call Transfer Rules</p>
          <p className="text-[11px] text-gray-400 dark:t3 mb-5">Configure scenarios where the agent hands off to a human.</p>
          <div className="rounded-xl border border-dashed border-gray-200 dark:b-theme p-8 text-center">
            <p className="text-sm text-gray-400 dark:t3">Transfer workflows coming soon.</p>
            <p className="text-xs text-gray-400 dark:t3 mt-1">Use your Setup tab to configure the forwarding number for now.</p>
          </div>
        </div>
        </motion.div>
      )}

      {/* ─── Voice Tab ────────────────────────────────────────────── */}
      {activeTab === 'voice' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
        >
        <div className="rounded-2xl border border-gray-200 dark:b-theme bg-white dark:bg-surface p-5">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gray-500 dark:t3 mb-1">Voice</p>
          <p className="text-[11px] text-gray-400 dark:t3 mb-5">Your agent&apos;s voice is configured in the Voice Library.</p>
          <a
            href="/dashboard/voices"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Open Voice Library
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
        </motion.div>
      )}

      {/* ─── Notifications Tab ────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.0 }}
        >
        <div className="rounded-2xl border b-theme bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Alerts</p>
            {!isAdmin && (
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                client.telegram_bot_token && client.telegram_chat_id
                  ? 'text-green-400 border-green-500/30 bg-green-500/10'
                  : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  client.telegram_bot_token && client.telegram_chat_id ? 'bg-green-500' : 'bg-amber-500'
                }`} />
                {client.telegram_bot_token && client.telegram_chat_id ? 'Telegram Connected' : 'Telegram Not Connected'}
              </span>
            )}
          </div>
          <p className="text-[11px] t3 mb-5">Coming soon — we&apos;ll notify you here when enabled.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left pb-3 t3 font-medium w-36" />
                  {(['Telegram', 'SMS', 'Email'] as const).map(ch => (
                    <th key={ch} className="pb-3 t3 font-medium px-6 text-center">{ch}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(['HOT lead', 'Missed call', 'Daily digest'] as const).map(event => (
                  <tr key={event}>
                    <td className="py-3 t2 font-medium pr-4">{event}</td>
                    {(['telegram', 'sms', 'email'] as const).map(ch => (
                      <td key={ch} className="py-3 px-6 text-center">
                        <button
                          role="switch"
                          aria-checked="false"
                          aria-label={`${event} via ${ch}`}
                          title="We'll notify you here once enabled"
                          disabled
                          className="w-9 h-5 rounded-full bg-hover relative inline-flex items-center justify-center transition-colors opacity-50 cursor-not-allowed"
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow absolute left-0.5 transition-all" />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
                {minuteLimit} minutes included per month. Reload anytime below.
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
                  <span className="text-xs t2 font-mono">{fmtDate(cycleEnd.toISOString())}</span>
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
          </div>
        )
      })()}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
