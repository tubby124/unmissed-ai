'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { NICHE_CONFIG } from '@/lib/niche-config'
import BorderBeam from '@/components/ui/border-beam'
import {
  fmtPhone,
  timeAgo,
  getPlanName,
  parseCsvRaw,
  detectKeyColumns,
  columnsToMarkdownTable,
} from '@/lib/settings-utils'

const PROVIDER_COLORS: Record<string, string> = {
  Cartesia: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Eleven Labs': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Inworld: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl: string
  languageLabel: string
}

const INJECT_PILLS = [
  { label: 'Away', text: "I'm currently away and unavailable until further notice. Please take a message." },
  { label: 'Holiday', text: "We're closed for the holiday. Normal business hours resume Monday." },
  { label: 'Promo', text: 'We have a limited-time promotion running — ask me for details!' },
]

interface AgentOverviewCardProps {
  client: ClientConfig
  isAdmin: boolean
  isActive: boolean
  onToggleStatus: () => void
}

export default function AgentOverviewCard({ client, isAdmin, isActive, onToggleStatus }: AgentOverviewCardProps) {
  // Editable identity fields
  const [agentName, setAgentName] = useState(client.agent_name ?? '')
  const [savedName, setSavedName] = useState(client.agent_name ?? '')
  const nameDirty = agentName !== savedName
  const footerDirty = nameDirty

  // Footer save
  const [footerSaving, setFooterSaving] = useState(false)
  const [footerSaved, setFooterSaved] = useState(false)

  // Voice picker — fetched from API, not hardcoded
  const [voiceId, setVoiceId] = useState(client.agent_voice_id ?? '')
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceSaved, setVoiceSaved] = useState(false)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voicePickerRef = useRef<HTMLDivElement>(null)

  // Fetch voice list on mount
  useEffect(() => {
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .finally(() => setVoicesLoading(false))
  }, [])

  // Close picker on outside click
  useEffect(() => {
    if (!voicePickerOpen) return
    function handler(e: MouseEvent) {
      if (voicePickerRef.current && !voicePickerRef.current.contains(e.target as Node)) {
        setVoicePickerOpen(false)
        setVoiceSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [voicePickerOpen])

  // Cleanup audio on unmount
  useEffect(() => () => { audioRef.current?.pause() }, [])

  const currentVoice = voices.find(v => v.voiceId === voiceId)
  const filteredVoices = voices.filter(v => {
    if (!voiceSearch) return true
    const q = voiceSearch.toLowerCase()
    return v.name.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q) || v.provider.toLowerCase().includes(q)
  })

  function playVoice(vid: string, previewUrl: string) {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (playingVoiceId === vid) { setPlayingVoiceId(null); return }
    const url = previewUrl || `/api/dashboard/voices/${vid}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingVoiceId(vid)
  }

  async function assignVoice(newVoiceId: string) {
    if (newVoiceId === voiceId) { setVoicePickerOpen(false); return }
    setVoiceSaving(true)
    setVoiceSaved(false)
    setVoiceId(newVoiceId) // optimistic
    setVoicePickerOpen(false)
    setVoiceSearch('')
    const res = await fetch('/api/dashboard/voices/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId: newVoiceId, ...(isAdmin ? { clientId: client.id } : {}) }),
    })
    setVoiceSaving(false)
    if (res.ok) {
      setVoiceSaved(true)
      setTimeout(() => setVoiceSaved(false), 3000)
    } else {
      setVoiceId(client.agent_voice_id ?? '') // rollback on error
    }
  }

  // SMS chip
  const [localSmsEnabled, setLocalSmsEnabled] = useState(client.sms_enabled ?? false)

  // Quick inject
  const [injectedNote, setInjectedNote] = useState(client.injected_note ?? '')
  const [injectLoading, setInjectLoading] = useState(false)
  const [injectSaved, setInjectSaved] = useState(false)

  // Context data
  const [contextData, setContextData] = useState(client.context_data ?? '')
  const [contextDataLabel, setContextDataLabel] = useState(client.context_data_label ?? '')
  const [contextDataSaving, setContextDataSaving] = useState(false)
  const [contextDataSaved, setContextDataSaved] = useState(false)

  // CSV upload
  const [csvUpload, setCsvUpload] = useState<Record<string, {
    allColumns: string[]
    allRows: string[][]
    selectedColumns: string[]
    rowCount: number
    truncated: boolean
  }>>({})
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Calendar modal
  const [showCalendarModal, setShowCalendarModal] = useState(false)

  // Derived display values
  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const minutesUsed = client.seconds_used_this_month != null ? Math.ceil(client.seconds_used_this_month / 60) : (client.minutes_used_this_month ?? 0)
  const minuteLimit = client.monthly_minute_limit ?? 500
  const totalAvailable = minuteLimit + (client.bonus_minutes ?? 0)
  const usagePct = totalAvailable > 0 ? (minutesUsed / totalAvailable) * 100 : 0

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function patch(body: Record<string, unknown>) {
    const payload = { ...body, ...(isAdmin ? { client_id: client.id } : {}) }
    return fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function saveFooter() {
    if (!nameDirty) return
    setFooterSaving(true)
    setFooterSaved(false)
    const trimmed = agentName.trim()
    const res = await patch({ agent_name: trimmed })
    setFooterSaving(false)
    if (res.ok) {
      setSavedName(trimmed)
      setFooterSaved(true)
      setTimeout(() => setFooterSaved(false), 3000)
    }
  }

  async function toggleSms() {
    const next = !localSmsEnabled
    if (!next && !confirm("Callers won't receive follow-up texts. Disable SMS?")) return
    setLocalSmsEnabled(next)
    const res = await patch({ sms_enabled: next })
    if (!res.ok) setLocalSmsEnabled(!next) // rollback
  }

  async function handleInject(text: string | null) {
    setInjectLoading(true)
    setInjectSaved(false)
    const res = await patch({ injected_note: text })
    setInjectLoading(false)
    if (res.ok) {
      setInjectedNote(text ?? '')
      setInjectSaved(true)
      setTimeout(() => setInjectSaved(false), 3000)
    }
  }

  async function saveContextData() {
    setContextDataSaving(true)
    setContextDataSaved(false)
    const res = await patch({ context_data: contextData, context_data_label: contextDataLabel })
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
      setCsvUpload(prev => ({
        ...prev,
        [client.id]: { allColumns: headers, allRows: limitedRows, selectedColumns: selected, rowCount: rows.length, truncated },
      }))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes antennaBlink {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0.2; }
        }
        @keyframes headScan {
          0%, 100% { background-position: 0 0; }
          50% { background-position: 0 100%; }
        }
        @keyframes armWave {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        .bot-antenna { animation: antennaBlink 2.4s ease-in-out infinite; }
        .bot-arm-l { animation: armWave 1.8s ease-in-out infinite; transform-origin: 80% 20%; }
        .bot-arm-r { animation: armWave 1.8s ease-in-out infinite reverse; transform-origin: 20% 20%; }
      `}</style>

      <div className="relative rounded-2xl border b-theme bg-surface p-5">
        {isActive && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <BorderBeam size={250} duration={12} colorFrom="#6366f1" colorTo="#a855f7" />
          </div>
        )}

        {/* ── Row 1: Identity ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5">

          {/* Bot + name + pills */}
          <div className="flex items-start gap-3 min-w-0">
            {/* CSS bot */}
            <div className="shrink-0 flex flex-col items-center gap-0 mt-0.5" aria-hidden="true">
              {/* Antenna */}
              <div className="bot-antenna w-0.5 h-3 bg-indigo-400/70 rounded-full mb-0.5" />
              {/* Head */}
              <div className="relative w-9 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                {/* Eyes */}
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-sm bg-indigo-400 animate-pulse" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 rounded-sm bg-indigo-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                {/* Scan line */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400/30 rounded-full" />
              </div>
              {/* Body */}
              <div className="relative w-7 h-5 rounded bg-indigo-500/15 border border-indigo-500/30 mt-0.5 flex items-center justify-center">
                <div className="w-3 h-1 rounded-full bg-indigo-400/50" />
                {/* Arms */}
                <div className="bot-arm-l absolute -left-2.5 top-0.5 w-2 h-4 rounded-full bg-indigo-500/30 border border-indigo-500/30" />
                <div className="bot-arm-r absolute -right-2.5 top-0.5 w-2 h-4 rounded-full bg-indigo-500/30 border border-indigo-500/30" />
              </div>
              {/* Feet */}
              <div className="flex gap-1 mt-0.5">
                <div className="w-2 h-1.5 rounded-sm bg-indigo-500/30 border border-indigo-500/30" />
                <div className="w-2 h-1.5 rounded-sm bg-indigo-500/30 border border-indigo-500/30" />
              </div>
            </div>

            {/* Name + pills */}
            <div className="min-w-0">
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
              <p className="text-[11px] t3 mt-0.5">{fmtPhone(client.twilio_number)}</p>
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={onToggleStatus}
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

        {/* ── Row 2: Editable fields 2-col grid ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Agent name */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Agent name</label>
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="e.g. Aisha"
              className="w-full text-xs t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50"
            />
          </div>
          {/* Voice picker */}
          <div className="relative" ref={voicePickerRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] t3 uppercase tracking-wider">Voice</label>
              {voiceSaving && <span className="text-[10px] t3 animate-pulse">Saving…</span>}
              {voiceSaved && <span className="text-[10px] text-green-400">✓ Updated</span>}
            </div>

            {/* Trigger button — shows current voice */}
            <button
              onClick={() => { setVoicePickerOpen(o => !o); setVoiceSearch('') }}
              className="w-full flex items-center gap-2 text-xs t1 bg-hover px-2.5 py-2 rounded-lg border b-theme hover:border-blue-500/30 transition-colors text-left"
            >
              {/* Play preview for current voice */}
              {currentVoice && (
                <button
                  onClick={e => { e.stopPropagation(); playVoice(currentVoice.voiceId, currentVoice.previewUrl) }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    playingVoiceId === currentVoice.voiceId ? 'bg-blue-500 text-white' : 'bg-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  {playingVoiceId === currentVoice.voiceId ? (
                    <div className="flex gap-px items-end" style={{width:10,height:8}}>
                      {[0,120,240].map((d,i)=>(
                        <div key={i} style={{width:2,height:7,background:'white',borderRadius:1,transformOrigin:'bottom',animation:`voiceBar 0.75s ease-in-out ${d}ms infinite`}}/>
                      ))}
                    </div>
                  ) : (
                    <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor"><path d="M0 0.5L7 4L0 7.5V0.5Z"/></svg>
                  )}
                </button>
              )}
              {!currentVoice && voicesLoading && (
                <div className="w-5 h-5 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
              )}
              <span className="flex-1 truncate">
                {voicesLoading ? 'Loading…' : (currentVoice?.name ?? (voiceId ? 'Unknown voice' : '— select voice —'))}
              </span>
              {currentVoice && (
                <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 shrink-0 ${PROVIDER_COLORS[currentVoice.provider] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                  {currentVoice.provider}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 t3">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Description hint below trigger */}
            {currentVoice?.description && !voicePickerOpen && (
              <p className="text-[10px] t3 mt-1 leading-relaxed line-clamp-1">{currentVoice.description}</p>
            )}

            {/* Dropdown */}
            <AnimatePresence>
              {voicePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-white/[0.1] shadow-2xl overflow-hidden"
                  style={{ background: 'var(--color-surface)', backdropFilter: 'blur(16px)', maxHeight: 280 }}
                >
                  {/* Search */}
                  <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search voices…"
                        value={voiceSearch}
                        onChange={e => setVoiceSearch(e.target.value)}
                        className="flex-1 text-xs t1 bg-transparent focus:outline-none placeholder:t3"
                      />
                    </div>
                  </div>

                  {/* Voice list */}
                  <div className="overflow-y-auto" style={{ maxHeight: 210 }}>
                    {voicesLoading ? (
                      <div className="px-3 py-4 text-xs t3 text-center">Loading voices…</div>
                    ) : filteredVoices.length === 0 ? (
                      <div className="px-3 py-4 text-xs t3 text-center">No voices match</div>
                    ) : filteredVoices.map(v => (
                      <div
                        key={v.voiceId}
                        className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors group ${v.voiceId === voiceId ? 'bg-blue-500/[0.06]' : ''}`}
                        onClick={() => assignVoice(v.voiceId)}
                      >
                        {/* Play button */}
                        <button
                          onClick={e => { e.stopPropagation(); playVoice(v.voiceId, v.previewUrl) }}
                          className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            playingVoiceId === v.voiceId
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/[0.06] text-zinc-500 hover:bg-white/[0.12] hover:text-white'
                          }`}
                        >
                          {playingVoiceId === v.voiceId ? (
                            <div className="flex gap-px items-end" style={{width:10,height:8}}>
                              {[0,120,240].map((d,i)=>(
                                <div key={i} style={{width:2,height:7,background:'white',borderRadius:1,transformOrigin:'bottom',animation:`voiceBar 0.75s ease-in-out ${d}ms infinite`}}/>
                              ))}
                            </div>
                          ) : (
                            <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor"><path d="M0 0.5L7 4L0 7.5V0.5Z"/></svg>
                          )}
                        </button>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium t1 truncate">{v.name}</span>
                            {v.voiceId === voiceId && (
                              <span className="text-[9px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5">Active</span>
                            )}
                            <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 shrink-0 ${PROVIDER_COLORS[v.provider] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                              {v.provider}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-[10px] t3 leading-relaxed line-clamp-1 mt-0.5">{v.description}</p>
                          )}
                        </div>
                        {/* Select indicator */}
                        {v.voiceId !== voiceId && (
                          <span className="text-[10px] t3 group-hover:text-blue-400 transition-colors shrink-0 pt-0.5">Use</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* AI phone — read-only */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">AI phone</label>
            <p className="text-xs t2 font-mono bg-hover px-3 py-2 rounded-lg border b-theme">{fmtPhone(client.twilio_number)}</p>
          </div>
          {/* Last updated — read-only */}
          <div>
            <label className="text-[10px] t3 uppercase tracking-wider block mb-1">Last updated</label>
            <p className="text-xs t3 font-mono bg-hover px-3 py-2 rounded-lg border b-theme">{timeAgo(client.updated_at)}</p>
          </div>
        </div>

        {/* ── Row 3: Usage bar ───────────────────────────────────────────────────── */}
        <div className="mb-5 pt-4 border-t b-theme">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Minutes This Month</p>
            <span className="text-xs font-mono t2 tabular-nums">{minutesUsed} / {totalAvailable} min</span>
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
              <p className="text-[11px] t3 tabular-nums font-mono">{totalAvailable - minutesUsed} min remaining</p>
            </div>
          )}
        </div>

        {/* ── Row 4: Connected services chips ───────────────────────────────────── */}
        <div className="mb-5 pt-4 border-t b-theme">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Connected services</p>
          <div className="flex flex-wrap gap-2">
            {/* Telegram — always on */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[11px] font-medium text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Telegram
            </div>

            {/* SMS follow-up — toggleable */}
            <button
              onClick={toggleSms}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${
                localSmsEnabled
                  ? 'border-green-500/30 bg-green-500/10 text-green-300'
                  : 'b-theme t3 hover:t2'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${localSmsEnabled ? 'bg-green-400' : 'bg-zinc-600'}`} />
              SMS follow-up
            </button>

            {/* Google Calendar */}
            {(() => {
              const calConnected = client.calendar_auth_status === 'connected'
              const calEnabled = !!client.booking_enabled
              const calClass = calConnected && calEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : calEnabled
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'b-theme t3 hover:t2'
              const dotClass = calConnected && calEnabled
                ? 'bg-emerald-400'
                : calEnabled
                ? 'bg-amber-400'
                : 'bg-zinc-600'
              return (
                <button
                  onClick={() => setShowCalendarModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${calClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  Google Calendar
                  {calEnabled && !calConnected && <span className="text-[9px] font-bold ml-0.5">!</span>}
                </button>
              )
            })()}

            {/* Call forwarding — coming soon */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border b-theme text-[11px] font-medium t3 opacity-50 cursor-not-allowed">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              Call forwarding
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-zinc-700 text-zinc-400 ml-0.5">soon</span>
            </div>
          </div>
        </div>

        {/* ── Row 5: Quick inject ────────────────────────────────────────────────── */}
        <div className="mb-5 pt-4 border-t b-theme">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Quick inject</p>
              <p className="text-[11px] t3 mt-0.5">Temporarily override agent behaviour — away message, holiday hours, promotions.</p>
            </div>
            {injectedNote && (
              <button
                onClick={() => handleInject(null)}
                disabled={injectLoading}
                className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg border b-theme t3 hover:t1 transition-all disabled:opacity-40"
              >
                Clear
              </button>
            )}
          </div>

          {/* Pre-fill pills */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {INJECT_PILLS.map(p => (
              <button
                key={p.label}
                onClick={() => setInjectedNote(p.text)}
                className="text-[10px] px-2.5 py-1 rounded-full border b-theme t3 hover:t2 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={injectedNote}
              onChange={e => setInjectedNote(e.target.value.slice(0, 500))}
              placeholder="E.g. I'm away until Monday. Please take a message and I'll call back."
              rows={3}
              maxLength={500}
              className="w-full bg-black/20 border b-theme rounded-xl p-3 text-xs t1 resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed pb-6"
            />
            <span className="absolute bottom-2 right-3 text-[10px] t3 tabular-nums pointer-events-none">
              {injectedNote.length}/500
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] t3">
              {injectedNote && !injectSaved
                ? 'Unsaved — click Inject to push live'
                : injectSaved
                ? ''
                : 'Empty = no override active'}
            </p>
            <button
              onClick={() => handleInject(injectedNote || null)}
              disabled={injectLoading}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 ${
                injectSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-blue-500 hover:bg-blue-400 text-white'
              }`}
            >
              {injectLoading ? 'Pushing...' : injectSaved ? '✓ Injected' : 'Inject'}
            </button>
          </div>
        </div>

        {/* ── Row 6: Context data (CSV) ─────────────────────────────────────────── */}
        <div className="pt-4 border-t b-theme">
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
                {contextDataSaving ? 'Saving...' : contextDataSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* Column picker — after CSV upload */}
          {csvUpload[client.id] && (
            <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold t1">
                  {csvUpload[client.id].rowCount} rows detected
                  {csvUpload[client.id].truncated && (
                    <span className="ml-2 text-[10px] text-amber-400/80 font-normal">(first 250 will be used)</span>
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

              {csvUpload[client.id].selectedColumns.length > 0 &&
                !csvUpload[client.id].selectedColumns.some(c => /unit|address|addr|suite|apt|door|property/i.test(c)) && (
                <p className="text-[11px] text-amber-400/80">
                  No unit or address column selected — address lookup may be less accurate.
                </p>
              )}

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
                    setContextData(markdown)
                    if (!contextDataLabel) setContextDataLabel('Tenant List')
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
                value={contextDataLabel}
                onChange={e => setContextDataLabel(e.target.value)}
                placeholder="Tenant List"
                className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-[11px] t3 block mb-1">Data <span className="t3">(paste or upload CSV — max ~32,000 chars)</span></label>
              <textarea
                value={contextData}
                onChange={e => setContextData(e.target.value)}
                placeholder={`Unit, Tenant, Rent\n4A, John Smith, $1200\n4B, Sarah Lee, $1350`}
                className="w-full h-40 bg-black/20 border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
                maxLength={32000}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] t3">{contextData.length.toLocaleString()} / 32,000 chars</p>
                {contextData.startsWith('|') && (
                  <p className="text-[10px] text-green-400/70">Lookup instructions auto-injected on every call</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer: Save name + voice ──────────────────────────────────────────── */}
        {footerDirty && (
          <div className="mt-5 pt-4 border-t b-theme flex items-center justify-between">
            <p className="text-[11px] t3">Unsaved changes to agent identity</p>
            <button
              onClick={saveFooter}
              disabled={footerSaving}
              className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-40 ${
                footerSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-blue-500 hover:bg-blue-400 text-white'
              }`}
            >
              {footerSaving ? 'Saving...' : footerSaved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* ── Calendar modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCalendarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowCalendarModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative rounded-2xl border b-theme bg-surface p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCalendarModal(false)}
                className="absolute top-4 right-4 t3 hover:t1 transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold t1">Google Calendar</p>
                  <p className="text-[11px] t3">Let your agent book appointments</p>
                </div>
              </div>

              {client.calendar_auth_status === 'connected' ? (
                <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-xs text-emerald-300">Calendar connected</span>
                  {client.google_calendar_id && (
                    <span className="text-[10px] font-mono t3 truncate">{client.google_calendar_id}</span>
                  )}
                </div>
              ) : client.calendar_auth_status === 'expired' ? (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  Authorization expired — reconnect below.
                </div>
              ) : null}

              <p className="text-[11px] t3 mb-4">
                Connect your Google Calendar so your AI agent can check real-time availability and schedule appointments during live calls.
              </p>

              <a
                href={`/api/auth/google${isAdmin ? `?client_id=${client.id}` : ''}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15.5 12A3.5 3.5 0 1112 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 8.5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {client.calendar_auth_status === 'connected' ? 'Reconnect Calendar' : 'Connect Google Calendar'}
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
