'use client'

import { useState, useCallback } from 'react'
import type { ClientConfig } from './page'

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

const NICHE_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  'auto-glass':          { label: 'Auto Glass',       color: 'text-blue-400',   border: 'border-blue-500/30' },
  'auto':                { label: 'Automotive',        color: 'text-blue-400',   border: 'border-blue-500/30' },
  'real-estate':         { label: 'Real Estate',       color: 'text-amber-400',  border: 'border-amber-500/30' },
  'real_estate':         { label: 'Real Estate',       color: 'text-amber-400',  border: 'border-amber-500/30' },
  'isa':                 { label: 'ISA / Real Estate',  color: 'text-amber-400',  border: 'border-amber-500/30' },
  'property-management': { label: 'Property Mgmt',     color: 'text-purple-400', border: 'border-purple-500/30' },
  'dental':              { label: 'Dental',             color: 'text-teal-400',   border: 'border-teal-500/30' },
  'hvac':                { label: 'HVAC',               color: 'text-orange-400', border: 'border-orange-500/30' },
  'plumbing':            { label: 'Plumbing',           color: 'text-cyan-400',   border: 'border-cyan-500/30' },
  'legal':               { label: 'Legal',              color: 'text-rose-400',   border: 'border-rose-500/30' },
  'voicemail':           { label: 'Voicemail',          color: 'text-zinc-400',   border: 'border-zinc-500/30' },
}

const KNOWN_VOICES: Record<string, string> = {
  'aa601962-1cbd-4bbd-9d96-3c7a93c3414a': 'Jacqueline',
  'd766b9e3-69df-4727-b62f-cd0b6772c2ad': 'Nour',
  '3bde8dc5-67c8-4e3f-82e1-b4f8e5c5db1c': 'Mark',
  'b9de4a89-7971-4ac8-aeea-d86fd8543a1a': 'Emily',
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
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-500 border border-white/[0.07] hover:text-zinc-200 hover:border-white/[0.15] transition-all shrink-0"
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
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono text-zinc-400 truncate">{url}</span>
      <CopyButton value={url} />
    </div>
  )
}

function ConfigRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 w-32 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono text-zinc-300 truncate">{value}</span>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}

interface SettingsViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  appUrl: string
}

export default function SettingsView({ clients, isAdmin, appUrl }: SettingsViewProps) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
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

  // AI Improve Prompt
  const [improveState, setImproveState] = useState<ImproveState>('idle')
  const [improveResult, setImproveResult] = useState<{
    improved_prompt: string
    change_summary: string[]
    call_count: number
    has_enough_data: boolean
  } | null>(null)
  const [improveError, setImproveError] = useState('')

  // Version History
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

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

  // Test Call
  const [testPhone, setTestPhone] = useState('')
  const [testCallState, setTestCallState] = useState<'idle' | 'calling' | 'done' | 'error'>('idle')
  const [testCallResult, setTestCallResult] = useState<{ callId?: string; twilio_sid?: string } | null>(null)
  const [testCallError, setTestCallError] = useState('')

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

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 'text-zinc-400', border: 'border-zinc-500/30' }
  const voiceName = client.agent_voice_id ? (KNOWN_VOICES[client.agent_voice_id] ?? null) : null
  const minutesUsed = client.minutes_used_this_month ?? 0
  const minuteLimit = client.monthly_minute_limit ?? 500
  const usagePct = Math.min((minutesUsed / minuteLimit) * 100, 100)

  const currentPrompt = prompt[client.id] ?? ''
  const originalPrompt = client.system_prompt ?? ''
  const dirty = currentPrompt !== originalPrompt
  const charCount = currentPrompt.length

  const inboundUrl = `${appUrl}/api/webhook/${client.slug}/inbound`
  const completedUrl = `${appUrl}/api/webhook/${client.slug}/completed`

  async function save() {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    setSaveUltravoxWarning(null)
    const body: Record<string, unknown> = { system_prompt: currentPrompt }
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
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
              All Clients — {clients.length} agents
            </p>
          </div>
          <div className="flex flex-wrap gap-1 p-3">
            {clients.map(c => {
              const n = c.niche ?? ''
              const nc = NICHE_CONFIG[n] ?? { label: n || 'General', color: 'text-zinc-400', border: 'border-zinc-500/30' }
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
                      : 'text-zinc-400 border-white/[0.07] hover:text-zinc-200 hover:bg-white/[0.04]'
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

      {/* 0 — Setup */}
      {(!setupComplete[client.id] || setupEditing) ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-500/20 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-400">Start here — complete your setup</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Your AI phone number</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono text-zinc-200">{fmtPhone(client.twilio_number) || 'Not yet assigned'}</span>
                {client.twilio_number && <CopyButton value={client.twilio_number} label="Copy" />}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1">Share this number — callers will reach your AI agent here.</p>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-2">
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
                placeholder="+1 306 555 0100"
                className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 ${!isAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
              />
              <p className="text-[11px] text-zinc-600 mt-1">
                {isAdmin
                  ? 'When a caller asks for a real person, your AI will live-transfer them to this number.'
                  : 'Live call transfer to your number — coming soon.'
                }
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="setup-complete"
                checked={setupComplete[client.id] ?? false}
                onChange={(e) => setSetupComplete(prev => ({ ...prev, [client.id]: e.target.checked }))}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
              <label htmlFor="setup-complete" className="text-xs text-zinc-400 cursor-pointer">Mark setup as complete</label>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveSetup}
                disabled={setupSaving}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 disabled:opacity-50 transition-colors"
              >
                {setupSaving ? 'Saving…' : 'Save setup'}
              </button>
              {setupSaved && <span className="text-xs text-green-400">Saved</span>}
              {setupEditing && (
                <button onClick={() => setSetupEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs text-zinc-400">Setup complete</span>
            {client.twilio_number && (
              <span className="text-xs font-mono text-zinc-600">{fmtPhone(client.twilio_number)}</span>
            )}
          </div>
          <button onClick={() => setSetupEditing(true)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Edit</button>
        </div>
      )}

      {/* 1 — Agent Overview */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Agent Overview</p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100">{client.business_name}</h2>
              {niche && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${nicheConfig.color} ${nicheConfig.border} bg-transparent`}>
                  {nicheConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Slug</span>
                <span className="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.07]">
                  {client.slug}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Last updated</span>
                <span className="text-xs text-zinc-500 font-mono">{timeAgo(client.updated_at)}</span>
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
              <span className={`text-[11px] font-medium ${isActive ? 'text-green-400' : 'text-zinc-500'}`}>
                {isActive ? 'Answering calls' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 — Webhooks + Phone */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-1">Webhooks & Phone</p>
        <p className="text-[11px] text-zinc-600 mb-4">Configure these in your Twilio console for this number</p>
        <UrlRow label="Inbound" url={inboundUrl} />
        <UrlRow label="Completed" url={completedUrl} />
        <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
          <span className="text-xs text-zinc-500 w-24 shrink-0">Twilio Number</span>
          <span className="flex-1 text-sm font-mono font-medium text-zinc-200">
            {fmtPhone(client.twilio_number)}
          </span>
          {client.twilio_number && <CopyButton value={client.twilio_number} />}
        </div>
      </div>

      {/* 3 — Agent Configuration */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-1">Agent Configuration</p>
        <p className="text-[11px] text-zinc-600 mb-4">Voice and AI model settings</p>
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
          <div className="flex items-center gap-3 pt-3 mt-1 border-t border-white/[0.04]">
            <button
              onClick={syncAgent}
              disabled={syncing}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                syncState === 'ok'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : syncState === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.07] hover:text-zinc-200'
              }`}
            >
              {syncing ? 'Syncing…' : syncState === 'ok' ? '✓ Synced' : syncState === 'error' ? '✗ Sync failed' : 'Re-sync Agent'}
            </button>
            <span className="text-[11px] text-zinc-600">
              {syncState === 'error' ? syncError : 'Force-push current prompt + voice to Ultravox'}
            </span>
          </div>
        )}
      </div>

      {/* 3b — God Mode (admin only) */}
      {isAdmin && godConfig[client.id] && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-400/80">God Mode</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Editable infrastructure settings</p>
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
              <label className="text-[11px] text-zinc-500 block mb-1">Telegram Bot Token <span className="text-zinc-700">(write-only — current value masked)</span></label>
              <input
                type="password"
                value={godConfig[client.id].telegram_bot_token}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], telegram_bot_token: e.target.value } }))}
                placeholder="Enter new token to update…"
                autoComplete="off"
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Telegram Chat ID */}
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Telegram Chat ID</label>
              <input
                type="text"
                value={godConfig[client.id].telegram_chat_id}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], telegram_chat_id: e.target.value } }))}
                placeholder="e.g. 7278536150"
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
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
                    : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.07]'
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
              <label className="text-[11px] text-zinc-500 block mb-1">Twilio Number</label>
              <input
                type="text"
                value={godConfig[client.id].twilio_number}
                onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], twilio_number: e.target.value } }))}
                placeholder="+15871234567"
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Timezone + Monthly Limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Timezone</label>
                <select
                  value={godConfig[client.id].timezone}
                  onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], timezone: e.target.value } }))}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/40 transition-colors"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Monthly Minute Limit</label>
                <input
                  type="number"
                  value={godConfig[client.id].monthly_minute_limit}
                  onChange={e => setGodConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], monthly_minute_limit: Number(e.target.value) } }))}
                  min={0}
                  step={50}
                  className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 — Usage */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">Minutes This Month</p>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {minutesUsed} / {minuteLimit} min
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-zinc-600">Resets 1st of each month</p>
          <p className="text-[11px] text-zinc-600 tabular-nums font-mono">
            {minuteLimit - minutesUsed} min remaining
          </p>
        </div>
      </div>

      {/* 5 — System Prompt */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">System Prompt</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {nicheConfig.label} agent instructions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums font-mono ${charCount > 48000 ? 'text-red-400' : charCount > 40000 ? 'text-amber-400' : 'text-zinc-600'}`}>
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
                  : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.06]'
              }`}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
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
          className="w-full h-[480px] bg-black/20 border border-white/[0.06] rounded-xl p-4 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
          spellCheck={false}
          placeholder={`Enter your ${nicheConfig.label} agent's system prompt…`}
        />
      </div>

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
        <p className="text-[11px] text-zinc-600 mb-4">
          AI reads your last 20 calls and your current prompt to suggest improvements. Review before applying.
        </p>

        {improveState === 'loading' && (
          <div className="flex items-center gap-2 py-4 text-zinc-400 text-xs">
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

            {improveResult.change_summary.length > 0 && (
              <div className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">What changed</p>
                <ul className="space-y-1">
                  {improveResult.change_summary.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                      <span className="text-purple-400 mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <textarea
              readOnly
              value={improveResult.improved_prompt}
              className="w-full h-48 bg-black/20 border border-white/[0.06] rounded-xl p-4 text-xs text-zinc-400 font-mono resize-none focus:outline-none leading-relaxed"
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
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[10px] text-zinc-600">
              After applying, review the prompt above and click &ldquo;Save Changes&rdquo; to deploy it live.
            </p>
          </div>
        )}
      </div>

      {/* 7 — Prompt Version History */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <button
          onClick={toggleVersions}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">Prompt History</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">View and restore previous system prompt versions</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            className={`text-zinc-600 transition-transform ${versionsOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {versionsOpen && (
          <div className="border-t border-white/[0.06]">
            {versionsLoading ? (
              <div className="flex items-center gap-2 px-5 py-4 text-xs text-zinc-600">
                <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-400 animate-spin" />
                Loading history…
              </div>
            ) : versions.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-600">No saved versions yet. Saving the prompt creates a version.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-zinc-300">v{v.version}</span>
                        {v.is_active && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">Active</span>
                        )}
                        <span className="text-[11px] text-zinc-600">
                          {new Date(v.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">{v.change_description}</p>
                    </div>
                    {!v.is_active && (
                      <button
                        onClick={() => restoreVersion(v.id)}
                        disabled={restoring === v.id}
                        className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 border border-white/[0.06] transition-all disabled:opacity-40"
                      >
                        {restoring === v.id ? 'Restoring…' : 'Restore'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8 — SMS Follow-up */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">SMS Follow-up</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Sent to the caller after each call ends. Powered by Twilio.</p>
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
        <div className="flex items-center gap-3 py-3 border-b border-white/[0.04]">
          <button
            onClick={() => setSmsEnabled(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${smsEnabled[client.id] ? 'bg-blue-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${smsEnabled[client.id] ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-xs text-zinc-400">
            {smsEnabled[client.id] ? 'Auto-send SMS after each call' : 'SMS disabled — callers will not receive a follow-up text'}
          </span>
        </div>

        {/* Template editor */}
        <div className="mt-3">
          <label className="text-[11px] text-zinc-500 block mb-1.5">Message Template</label>
          <textarea
            value={smsTemplate[client.id] ?? ''}
            onChange={e => setSmsTemplate(prev => ({ ...prev, [client.id]: e.target.value }))}
            disabled={!smsEnabled[client.id]}
            rows={3}
            className="w-full bg-black/20 border border-white/[0.06] rounded-xl p-3 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            placeholder="Thanks for calling {{business}}! We'll follow up shortly."
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Placeholders: <span className="font-mono text-zinc-500">{'{{business}}'}</span> = business name &nbsp;·&nbsp; <span className="font-mono text-zinc-500">{'{{summary}}'}</span> = call summary excerpt
          </p>
        </div>

        {/* Live preview */}
        {smsTemplate[client.id] && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">Preview</p>
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {(smsTemplate[client.id] ?? '')
                .replace(/\{\{business\}\}/g, client.business_name || '')
                .replace(/\{\{summary\}\}/g, '[call summary]')}
            </p>
          </div>
        )}

        {/* Test SMS */}
        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <p className="text-[11px] text-zinc-500 mb-2">Send a test SMS to verify delivery</p>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={testSmsPhone}
              onChange={e => setTestSmsPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fireTestSms()}
              placeholder="+14031234567"
              disabled={testSmsState === 'sending'}
              className="flex-1 bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
            />
            <button
              onClick={fireTestSms}
              disabled={!testSmsPhone.trim() || testSmsState === 'sending' || !smsTemplate[client.id]}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-all disabled:opacity-40 shrink-0"
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
                className="text-[10px] text-zinc-600 hover:text-zinc-400"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 8b — Advanced Context */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">Advanced Context</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Extra knowledge injected into your agent&apos;s prompt</p>
          </div>
          <button
            onClick={saveAdvanced}
            disabled={advancedSaving}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              advancedSaved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
            } disabled:opacity-40`}
          >
            {advancedSaving ? 'Saving…' : advancedSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>

        {/* Business Facts */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] text-zinc-500 block">Business facts</label>
          <p className="text-[10px] text-zinc-600">
            Anything your agent should always know — hours exceptions, parking, nearby landmarks, key staff names
          </p>
          <textarea
            value={businessFacts[client.id] ?? ''}
            onChange={e => setBusinessFacts(prev => ({ ...prev, [client.id]: e.target.value }))}
            rows={4}
            className="w-full bg-black/20 border border-white/[0.06] rounded-xl p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
            placeholder="e.g. Parking is free out front. We're near the Walmart on 22nd St. Our lead tech is Ryan. Closed Christmas Day and Boxing Day."
          />
        </div>

        {/* Extra Q&A pairs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] text-zinc-500 block">Extra Q&amp;A pairs</label>
              <p className="text-[10px] text-zinc-600">Common caller questions not covered in the wizard</p>
            </div>
            {(extraQA[client.id]?.length ?? 0) < 10 && (
              <button
                type="button"
                onClick={() => setExtraQA(prev => ({
                  ...prev,
                  [client.id]: [...(prev[client.id] ?? []), { q: '', a: '' }],
                }))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 border border-white/[0.07] hover:text-zinc-200 hover:border-white/[0.15] transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Add
              </button>
            )}
          </div>

          {(extraQA[client.id] ?? []).length === 0 && (
            <p className="text-[11px] text-zinc-700 py-1">No Q&amp;A pairs yet — add up to 10.</p>
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
                  className="bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
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
                  className="bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setExtraQA(prev => ({
                    ...prev,
                    [client.id]: (prev[client.id] ?? []).filter((_, i) => i !== idx),
                  }))}
                  className="p-2 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.07] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9 — Test Call */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-1">Test Call</p>
        <p className="text-[11px] text-zinc-600 mb-4">
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
            className="flex-1 bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          />
          <button
            onClick={fireTestCall}
            disabled={!testPhone.trim() || testCallState === 'calling'}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-40 disabled:bg-zinc-700 shrink-0"
          >
            {testCallState === 'calling' ? 'Dialing…' : 'Call Me'}
          </button>
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
              className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400"
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
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
