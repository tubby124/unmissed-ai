'use client'

/**
 * AgentIdentityCard — Phase 2 v3 launch cut (2026-04-26).
 *
 * Consolidates AgentSpeaksCard + VoicePickerDropdown + TodayUpdateCard into one
 * surface and adds the identity vars (close-person, business name) that were
 * previously buried in /dashboard/settings → Agent Variables.
 *
 * One card, seven inline-editable rows:
 *   1. Agent name           (AGENT_NAME       → /api/dashboard/variables)
 *   2. Business name        (BUSINESS_NAME    → /api/dashboard/variables)
 *   3. Callback contact     (CLOSE_PERSON     → /api/dashboard/variables)
 *   4. Greeting line        (GREETING_LINE    → /api/dashboard/variables)
 *   5. Voice + preview      (agent_voice_id   → /api/dashboard/settings)
 *      voice preview always proxied through /api/dashboard/voices/[id]/preview
 *      so the browser <audio> tag has cookies, not Ultravox X-API-Key.
 *   6. After-call SMS       (sms_enabled / sms_template → /api/dashboard/settings)
 *   7. Telegram pill        (one-tap deep link via /api/dashboard/telegram-link)
 *   + Collapsible "Today's update" row (injected_note → /api/dashboard/settings)
 *
 * Voice and SMS toggles only render when the client has a Twilio number on plan
 * (otherwise they would be fake controls — see core-operating-mode.md).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  languageLabel: string
}

interface VariableEntry {
  value: string
  meta: { editable: boolean; label: string }
}

interface VariablesResponse {
  variables: Record<string, VariableEntry>
}

interface Props {
  clientId: string
  isAdmin?: boolean
  /** Optimistic agent name from HomeData — replaced once variables load. */
  agentName: string
  /** Optimistic business name from HomeData. */
  businessName: string | null
  /** Voice currently selected on the agent. */
  currentVoiceId: string | null
  currentPreset: string | null
  smsEnabled: boolean
  smsTemplate: string | null
  hasTwilioNumber: boolean
  telegramConnected: boolean
  telegramBotUrl: string | null
  injectedNote: string | null
  injectedNoteExpiresAt: string | null
  /** Refresh HomeData after a save. */
  onChanged?: () => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  Cartesia: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Eleven Labs': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Inworld: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const VOICE_PRESETS = [
  { key: 'casual_friendly', label: 'Casual & Friendly' },
  { key: 'professional_warm', label: 'Professional & Warm' },
  { key: 'formal', label: 'Formal' },
  { key: 'energetic', label: 'Energetic' },
  { key: 'empathetic', label: 'Empathetic' },
] as const

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentIdentityCard({
  clientId,
  isAdmin = false,
  agentName,
  businessName,
  currentVoiceId,
  currentPreset,
  smsEnabled,
  smsTemplate,
  hasTwilioNumber,
  telegramConnected,
  telegramBotUrl,
  injectedNote,
  injectedNoteExpiresAt,
  onChanged,
}: Props) {
  // ── Identity / greeting state (loaded from /api/dashboard/variables) ──────
  const [variables, setVariables] = useState<Record<string, string>>({
    AGENT_NAME: agentName,
    BUSINESS_NAME: businessName ?? '',
    CLOSE_PERSON: '',
    GREETING_LINE: '',
  })
  const [variablesLoaded, setVariablesLoaded] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const fetchVariables = useCallback(async () => {
    try {
      const url = isAdmin ? `/api/dashboard/variables?client_id=${clientId}` : '/api/dashboard/variables'
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return
      const data = (await res.json()) as VariablesResponse
      const next: Record<string, string> = {
        AGENT_NAME: data.variables.AGENT_NAME?.value ?? agentName,
        BUSINESS_NAME: data.variables.BUSINESS_NAME?.value ?? businessName ?? '',
        CLOSE_PERSON: data.variables.CLOSE_PERSON?.value ?? '',
        GREETING_LINE: data.variables.GREETING_LINE?.value ?? '',
      }
      setVariables(next)
      setVariablesLoaded(true)
    } catch {
      setVariablesLoaded(true)
    }
  }, [clientId, isAdmin, agentName, businessName])
  useEffect(() => { fetchVariables() }, [fetchVariables])

  async function saveVariable(key: string, value: string) {
    if (value === variables[key]) {
      setEditingKey(null)
      return
    }
    setSavingKey(key)
    try {
      const body: Record<string, unknown> = { variableKey: key, value }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/variables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
        return
      }
      setVariables(v => ({ ...v, [key]: value }))
      setEditingKey(null)
      toast.success('Saved')
      onChanged?.()
    } finally {
      setSavingKey(null)
    }
  }

  // ── SMS state ─────────────────────────────────────────────────────────────
  const [smsOn, setSmsOn] = useState(smsEnabled)
  const [tpl, setTpl] = useState<string>(smsTemplate ?? '')
  const [tplDraft, setTplDraft] = useState<string>(smsTemplate ?? '')
  const [editingTpl, setEditingTpl] = useState(false)
  const [savingSms, setSavingSms] = useState(false)
  useEffect(() => { setSmsOn(smsEnabled) }, [smsEnabled])
  useEffect(() => {
    setTpl(smsTemplate ?? '')
    if (!editingTpl) setTplDraft(smsTemplate ?? '')
  }, [smsTemplate, editingTpl])

  async function patchSettings(payload: Record<string, unknown>) {
    setSavingSms(true)
    try {
      const body: Record<string, unknown> = { ...payload }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
        return false
      }
      toast.success('Saved')
      onChanged?.()
      return true
    } finally {
      setSavingSms(false)
    }
  }

  async function toggleSms(next: boolean) {
    setSmsOn(next) // optimistic
    const ok = await patchSettings({ sms_enabled: next })
    if (!ok) setSmsOn(!next)
  }

  async function saveSmsTemplate() {
    if (tplDraft === tpl) { setEditingTpl(false); return }
    const ok = await patchSettings({ sms_template: tplDraft })
    if (ok) {
      setTpl(tplDraft)
      setEditingTpl(false)
    }
  }

  // ── Voice state ───────────────────────────────────────────────────────────
  const [voiceExpanded, setVoiceExpanded] = useState(false)
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState(currentVoiceId)
  const [selectedPreset, setSelectedPreset] = useState(currentPreset ?? 'casual_friendly')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [savingVoice, setSavingVoice] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voiceSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setSelectedVoiceId(currentVoiceId) }, [currentVoiceId])
  useEffect(() => { setSelectedPreset(currentPreset ?? 'casual_friendly') }, [currentPreset])

  // Lazy-fetch voices on first expand
  const voicesFetchedRef = useRef(false)
  useEffect(() => {
    if (!voiceExpanded || voicesFetchedRef.current) return
    voicesFetchedRef.current = true
    setVoicesLoading(true)
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [voiceExpanded])

  // Stop audio on unmount
  useEffect(() => () => { audioRef.current?.pause() }, [])

  const currentVoice = voices.find(v => v.voiceId === selectedVoiceId)
  const currentPresetLabel = VOICE_PRESETS.find(p => p.key === selectedPreset)?.label ?? 'Casual & Friendly'
  const filteredVoices = voices.filter(v => {
    if (!voiceSearch) return true
    const q = voiceSearch.toLowerCase()
    return v.name.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q) || v.provider.toLowerCase().includes(q)
  })

  // Always proxy. Direct Ultravox previewUrl needs X-API-Key — can't be set on
  // a browser <audio> element, so it silently fails to load.
  const playVoice = useCallback((voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null)
      return
    }
    const url = `/api/dashboard/voices/${voiceId}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audioRef.current = audio
    setPlayingVoiceId(voiceId)
    audio.play().catch(() => setPlayingVoiceId(null))
  }, [playingVoiceId])

  async function selectVoice(voiceId: string) {
    if (voiceId === selectedVoiceId || savingVoice) return
    setSavingVoice(true)
    setSelectedVoiceId(voiceId) // optimistic
    try {
      const body: Record<string, unknown> = { agent_voice_id: voiceId }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { toast.success('Voice updated'); onChanged?.() }
      else toast.error('Voice save failed')
    } finally { setSavingVoice(false) }
  }

  async function selectPreset(presetKey: string) {
    if (presetKey === selectedPreset || savingVoice) return
    setSavingVoice(true)
    setSelectedPreset(presetKey) // optimistic
    try {
      const body: Record<string, unknown> = { voice_style_preset: presetKey }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { toast.success('Personality updated'); onChanged?.() }
      else toast.error('Personality save failed')
    } finally { setSavingVoice(false) }
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  const [telegramLoading, setTelegramLoading] = useState(false)
  async function handleTelegramClick() {
    if (telegramConnected && telegramBotUrl) {
      window.open(telegramBotUrl, '_blank', 'noopener')
      return
    }
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/dashboard/telegram-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json() as { deepLink?: string }
      if (data.deepLink) window.open(data.deepLink, '_blank', 'noopener')
    } catch {
      toast.error('Could not open Telegram link')
    } finally { setTelegramLoading(false) }
  }

  // ── Today's update ────────────────────────────────────────────────────────
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [note, setNote] = useState(injectedNote ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(injectedNote ? new Date() : null)
  const [noteExpiresAt, setNoteExpiresAt] = useState<Date | null>(
    injectedNoteExpiresAt ? new Date(injectedNoteExpiresAt) : null
  )

  function noteAgo(): string {
    if (!noteSavedAt) return ''
    const diff = Math.round((Date.now() - noteSavedAt.getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    const h = Math.floor(diff / 60)
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
  }
  function noteExpires(): string {
    if (!noteExpiresAt) return ''
    const diff = Math.round((noteExpiresAt.getTime() - Date.now()) / 60000)
    if (diff <= 0) return 'expired'
    if (diff < 60) return `expires in ${diff}m`
    const h = Math.floor(diff / 60)
    return h < 24 ? `expires in ${h}h` : `expires ${noteExpiresAt.toLocaleDateString()}`
  }

  async function saveNote(value: string | null) {
    setNoteSaving(true)
    try {
      const body: Record<string, unknown> = { injected_note: value }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
        return
      }
      if (value === null) {
        setNote('')
        setNoteExpiresAt(null)
      } else {
        setNoteExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000))
      }
      setNoteSavedAt(new Date())
      toast.success('Update saved')
      onChanged?.()
    } finally { setNoteSaving(false) }
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const isEditing = (key: string) => editingKey === key

  function startEdit(key: string) {
    setDraft(variables[key] ?? '')
    setEditingKey(key)
  }

  function cancelEdit() {
    setEditingKey(null)
  }

  // Inline field-rendering helper — used in identity grid + greeting row.
  // `multiline` = use textarea instead of input (greeting has paragraphs).
  const renderField = (
    key: string,
    label: string,
    placeholder: string,
    opts: { multiline?: boolean; description?: string; emptyHint?: string } = {}
  ) => (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="text-[11px] font-semibold t1">{label}</p>
          {opts.description && (
            <p className="text-[10px] t3">{opts.description}</p>
          )}
        </div>
        {!isEditing(key) && variablesLoaded && (
          <button
            type="button"
            onClick={() => startEdit(key)}
            className="text-[10px] font-medium px-2 py-0.5 rounded-md cursor-pointer shrink-0"
            style={{ color: 'var(--color-primary)' }}
          >
            Edit
          </button>
        )}
      </div>
      {isEditing(key) ? (
        <>
          {opts.multiline ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={Math.min(4, Math.max(2, draft.split('\n').length + 1))}
              autoFocus
              className="w-full text-[12px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-y leading-relaxed"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full text-[12px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
              onKeyDown={e => {
                if (e.key === 'Enter') saveVariable(key, draft.trim())
                if (e.key === 'Escape') cancelEdit()
              }}
            />
          )}
          <div className="flex items-center justify-end gap-2 mt-1.5">
            <button
              type="button"
              onClick={cancelEdit}
              className="text-[10px] t3 hover:t2 px-2 py-1 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveVariable(key, opts.multiline ? draft : draft.trim())}
              disabled={savingKey === key || (opts.multiline ? draft : draft.trim()) === variables[key]}
              className="text-[10px] font-semibold px-3 py-1 rounded-md disabled:opacity-40 bg-blue-500 hover:bg-blue-400 text-white cursor-pointer"
            >
              {savingKey === key ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : !variablesLoaded ? (
        <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">Loading…</p>
      ) : variables[key] ? (
        <p className={`text-[12px] t2 bg-hover rounded-lg px-3 py-2 leading-relaxed${opts.multiline ? ' whitespace-pre-wrap' : ''}`}>{variables[key]}</p>
      ) : (
        <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">{opts.emptyHint ?? 'Not set — click Edit'}</p>
      )}
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2.5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold t1">Your agent</p>
          <p className="text-[10px] t3">Identity, voice, and the things callers actually hear.</p>
        </div>

        {/* Telegram pill */}
        <button
          type="button"
          onClick={handleTelegramClick}
          disabled={telegramLoading}
          aria-label={telegramConnected ? 'Telegram connected' : 'Connect Telegram'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: telegramConnected ? 'rgba(34,197,94,0.12)' : 'rgba(44,165,224,0.12)',
            color: telegramConnected ? 'rgb(52,211,153)' : 'rgb(96,165,250)',
            border: `1px solid ${telegramConnected ? 'rgba(52,211,153,0.25)' : 'rgba(96,165,250,0.25)'}`,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
          </svg>
          {telegramConnected ? 'Telegram on' : telegramLoading ? '...' : 'Connect'}
        </button>
      </div>

      {/* ── Identity grid — 2-col on md+, 1-col mobile ───────────────────── */}
      {/* Layout (md+): [AGENT_NAME | BUSINESS_NAME] / [CLOSE_PERSON | VOICE button] */}
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {/* AGENT_NAME — top-left */}
        <div
          className="px-4 py-3 border-b md:border-r"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {renderField('AGENT_NAME', 'Agent name', 'e.g. Aisha')}
        </div>
        {/* BUSINESS_NAME — top-right */}
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {renderField('BUSINESS_NAME', 'Business name', 'e.g. Aisha Realty')}
        </div>
        {/* CLOSE_PERSON — bottom-left */}
        <div
          className="px-4 py-3 border-b md:border-b-0 md:border-r"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {renderField('CLOSE_PERSON', 'Callback contact (your name)', 'e.g. Hasan')}
        </div>
        {/* Voice button — bottom-right (collapsed header only; expanded panel below grid) */}
        <button
          type="button"
          onClick={() => { setVoiceExpanded(o => !o); if (voiceExpanded) setVoiceSearch('') }}
          aria-expanded={voiceExpanded}
          aria-label={voiceExpanded ? 'Collapse voice picker' : 'Expand voice picker'}
          className="w-full h-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold t1">Voice</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[12px] font-medium truncate t1">
                {currentVoice?.name ?? (selectedVoiceId ? 'Loading...' : 'No voice selected')}
              </span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0"
                style={{ color: 'var(--color-text-3)', borderColor: 'var(--color-border)' }}
              >
                {currentPresetLabel}
              </span>
            </div>
          </div>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className="shrink-0 transition-transform duration-200"
            style={{ color: 'var(--color-text-3)', transform: voiceExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Voice expanded panel — full width when open ──────────────────── */}
      <AnimatePresence>
        {voiceExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {/* Personality presets */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2 t3">Personality</p>
              <div className="flex flex-wrap gap-2">
                {VOICE_PRESETS.map(p => {
                  const active = selectedPreset === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => selectPreset(p.key)}
                      disabled={savingVoice}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all disabled:opacity-50 cursor-pointer ${
                        active
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-transparent border-[var(--color-border)] hover:border-blue-500/40'
                      }`}
                      style={!active ? { color: 'var(--color-text-2)' } : undefined}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Voice search */}
            <div className="px-4 pb-3">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 border"
                style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: 'var(--color-text-3)' }}>
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  ref={voiceSearchRef}
                  type="text"
                  placeholder="Search voices..."
                  value={voiceSearch}
                  onChange={e => setVoiceSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                  style={{ color: 'var(--color-text-1)' }}
                />
              </div>
            </div>

            {/* Voice list */}
            <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: 240 }}>
              {voicesLoading ? (
                <div className="px-3 py-6 text-xs text-center t3">Loading voices...</div>
              ) : filteredVoices.length === 0 ? (
                <div className="px-3 py-6 text-xs text-center t3">No voices match</div>
              ) : (
                filteredVoices.map(v => {
                  const isSelected = v.voiceId === selectedVoiceId
                  const isPlaying = playingVoiceId === v.voiceId
                  return (
                    <div
                      key={v.voiceId}
                      onClick={() => selectVoice(v.voiceId)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors group"
                      style={{ background: isSelected ? 'rgba(59,130,246,0.06)' : undefined }}
                    >
                      {/* Play button */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); playVoice(v.voiceId) }}
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          background: isPlaying ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                          color: isPlaying ? '#fff' : 'var(--color-text-3)',
                        }}
                      >
                        {isPlaying ? (
                          <div className="flex gap-px items-end" style={{ width: 10, height: 8 }}>
                            {[0, 120, 240].map((d, i) => (
                              <div
                                key={i}
                                style={{
                                  width: 2, height: 7, background: 'white', borderRadius: 1,
                                  transformOrigin: 'bottom',
                                  animation: `voiceBar 0.75s ease-in-out ${d}ms infinite`,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <svg width="8" height="9" viewBox="0 0 7 8" fill="currentColor">
                            <path d="M0 0.5L7 4L0 7.5V0.5Z"/>
                          </svg>
                        )}
                      </button>

                      {/* Voice info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-medium truncate t1">{v.name}</span>
                          <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 shrink-0 ${PROVIDER_COLORS[v.provider] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                            {v.provider}
                          </span>
                        </div>
                        {v.description && (
                          <p className="text-[10px] leading-relaxed line-clamp-1 mt-0.5 t3">{v.description}</p>
                        )}
                      </div>

                      {/* Selected indicator */}
                      {isSelected ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                          <circle cx="7" cy="7" r="6" stroke="#3b82f6" strokeWidth="1.5"/>
                          <path d="M4.5 7L6.5 9L9.5 5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity t3">Use</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Greeting — full-width (needs the room) ───────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {renderField('GREETING_LINE', 'Greeting', '', {
          multiline: true,
          description: 'First thing your agent says when answering.',
          emptyHint: 'Not set — click Edit to add a greeting',
        })}
      </div>

      {/* ── After-call SMS row ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div>
            <p className="text-[11px] font-semibold t1">After-call text</p>
            <p className="text-[10px] t3">Auto-send a text after every call so the caller can reach you back.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleSms(!smsOn)}
            disabled={savingSms || !hasTwilioNumber}
            aria-pressed={smsOn}
            aria-label={smsOn ? 'Turn off after-call text' : 'Turn on after-call text'}
            className="shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: smsOn ? 'rgb(34,197,94)' : 'var(--color-hover)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              style={{ transform: smsOn ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {!hasTwilioNumber && (
          <p className="text-[10px] mt-1" style={{ color: 'rgb(245,158,11)' }}>
            Requires a phone number — upgrade to enable.
          </p>
        )}

        {smsOn && hasTwilioNumber && (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-medium t3 uppercase tracking-wider">Message</p>
              {!editingTpl && (
                <button
                  type="button"
                  onClick={() => { setTplDraft(tpl); setEditingTpl(true) }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Edit
                </button>
              )}
            </div>
            {editingTpl ? (
              <>
                <textarea
                  value={tplDraft}
                  onChange={e => setTplDraft(e.target.value)}
                  rows={Math.min(4, Math.max(2, tplDraft.split('\n').length + 1))}
                  autoFocus
                  className="w-full text-[12px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-y leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setTplDraft(tpl); setEditingTpl(false) }}
                    className="text-[10px] t3 hover:t2 px-2 py-1 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveSmsTemplate}
                    disabled={savingSms || tplDraft === tpl}
                    className="text-[10px] font-semibold px-3 py-1 rounded-md disabled:opacity-40 bg-blue-500 hover:bg-blue-400 text-white cursor-pointer"
                  >
                    {savingSms ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            ) : tpl ? (
              <p className="text-[12px] t2 bg-hover rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{tpl}</p>
            ) : (
              <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">Using default — click Edit to customize</p>
            )}
          </div>
        )}
      </div>

      {/* ── Today's update (collapsible) ──────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setNoteExpanded(o => !o)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(245,158,11)' }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold t1">Today&apos;s update</p>
            <p className="text-[10px] t3">
              {note.trim()
                ? `Active${noteExpiresAt ? ` · ${noteExpires()}` : ''}`
                : 'Inject a one-off note for the next call (optional)'}
            </p>
          </div>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className="shrink-0 transition-transform duration-200"
            style={{ color: 'var(--color-text-3)', transform: noteExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <AnimatePresence>
          {noteExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Closed Monday, boss is traveling, special hours this week..."
                  className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 placeholder:opacity-40"
                  style={{
                    backgroundColor: 'var(--color-hover)',
                    color: 'var(--color-text-1)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                {noteSavedAt && (
                  <p className="text-[11px] t3">
                    {note.trim() ? `Synced · ${noteAgo()}${noteExpiresAt ? ` · ${noteExpires()}` : ''}` : 'No active update'}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveNote(note.trim() || null)}
                    disabled={noteSaving || note.trim() === (injectedNote ?? '')}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {noteSaving ? 'Saving…' : 'Update agent'}
                  </button>
                  {note.trim() && (
                    <button
                      type="button"
                      onClick={() => saveNote(null)}
                      disabled={noteSaving}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-75 disabled:opacity-40 cursor-pointer"
                      style={{ color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
                    >
                      Clear
                    </button>
                  )}
                  {note.trim() && (
                    <span className="ml-auto text-[10px] t3">{note.length}/500</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
