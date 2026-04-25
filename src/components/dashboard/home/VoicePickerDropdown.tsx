'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl: string
  languageLabel: string
}

interface VoicePickerDropdownProps {
  clientId: string
  currentVoiceId: string | null
  currentPreset: string | null
  isAdmin?: boolean
  onVoiceChanged?: () => void
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

export default function VoicePickerDropdown({
  clientId,
  currentVoiceId,
  currentPreset,
  isAdmin = false,
  onVoiceChanged,
}: VoicePickerDropdownProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false)
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState(currentVoiceId)
  const [selectedPreset, setSelectedPreset] = useState(currentPreset ?? 'casual_friendly')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch voices on first expand ─────────────────────────────────────────
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (!expanded || fetchedRef.current) return
    fetchedRef.current = true
    setVoicesLoading(true)
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [expanded])

  // Focus search on expand
  useEffect(() => {
    if (expanded) setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [expanded])

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setVoiceSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Cleanup audio on unmount
  useEffect(() => () => { audioRef.current?.pause() }, [])

  // Sync props when they change externally
  useEffect(() => { setSelectedVoiceId(currentVoiceId) }, [currentVoiceId])
  useEffect(() => { setSelectedPreset(currentPreset ?? 'casual_friendly') }, [currentPreset])

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentVoice = voices.find(v => v.voiceId === selectedVoiceId)
  const currentPresetLabel = VOICE_PRESETS.find(p => p.key === selectedPreset)?.label ?? 'Casual & Friendly'

  const filteredVoices = voices.filter(v => {
    if (!voiceSearch) return true
    const q = voiceSearch.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      v.provider.toLowerCase().includes(q)
    )
  })

  // ── Audio preview ────────────────────────────────────────────────────────
  const playVoice = useCallback((voiceId: string, previewUrl: string) => {
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
    const url = previewUrl || `/api/dashboard/voices/${voiceId}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audioRef.current = audio
    setPlayingVoiceId(voiceId)
    audio.play().catch(() => setPlayingVoiceId(null))
  }, [playingVoiceId])

  // ── Save helpers ─────────────────────────────────────────────────────────
  async function patchSettings(body: Record<string, unknown>) {
    setSaving(true)
    const payload = { ...body, ...(isAdmin ? { client_id: clientId } : {}) }
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Saved')
        onVoiceChanged?.()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Save failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function selectVoice(voiceId: string) {
    if (voiceId === selectedVoiceId) return
    setSelectedVoiceId(voiceId) // optimistic
    await patchSettings({ agent_voice_id: voiceId })
  }

  async function selectPreset(presetKey: string) {
    if (presetKey === selectedPreset) return
    setSelectedPreset(presetKey) // optimistic
    await patchSettings({ voice_style_preset: presetKey })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      {/* ── Collapsed bar ─────────────────────────────────────────────── */}
      <button
        onClick={() => { setExpanded(o => !o); if (expanded) setVoiceSearch('') }}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Mic icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-tint, rgba(59,130,246,0.08))' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-accent, #3b82f6)' }}>
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Label + current voice info */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
            Choose Voice
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
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

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className="shrink-0 transition-transform duration-200"
          style={{ color: 'var(--color-text-3)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Expanded panel ────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              {/* ── Personality presets ────────────────────────────────── */}
              <div className="px-4 pt-4 pb-3">
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2.5" style={{ color: 'var(--color-text-3)' }}>
                  Personality
                </p>
                <div className="flex flex-wrap gap-2">
                  {VOICE_PRESETS.map(p => {
                    const active = selectedPreset === p.key
                    return (
                      <button
                        key={p.key}
                        onClick={() => selectPreset(p.key)}
                        disabled={saving}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all disabled:opacity-50 ${
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

              {/* ── Voice search ───────────────────────────────────────── */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 border" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--color-border)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: 'var(--color-text-3)' }}>
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search voices..."
                    value={voiceSearch}
                    onChange={e => setVoiceSearch(e.target.value)}
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                    style={{ color: 'var(--color-text-1)' }}
                  />
                </div>
              </div>

              {/* ── Voice list ─────────────────────────────────────────── */}
              <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: 300 }}>
                {voicesLoading ? (
                  <div className="px-3 py-6 text-xs text-center" style={{ color: 'var(--color-text-3)' }}>
                    Loading voices...
                  </div>
                ) : filteredVoices.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-center" style={{ color: 'var(--color-text-3)' }}>
                    No voices match
                  </div>
                ) : (
                  filteredVoices.map(v => {
                    const isSelected = v.voiceId === selectedVoiceId
                    const isPlaying = playingVoiceId === v.voiceId
                    return (
                      <div
                        key={v.voiceId}
                        onClick={() => selectVoice(v.voiceId)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors group"
                        style={{
                          background: isSelected ? 'var(--color-accent-tint, rgba(59,130,246,0.06))' : undefined,
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)') }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = 'transparent') }}
                      >
                        {/* Play/Stop button */}
                        <button
                          onClick={e => { e.stopPropagation(); playVoice(v.voiceId, v.previewUrl) }}
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
                            <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
                              {v.name}
                            </span>
                            <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 shrink-0 ${PROVIDER_COLORS[v.provider] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                              {v.provider}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-[10px] leading-relaxed line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                              {v.description}
                            </p>
                          )}
                        </div>

                        {/* Selected indicator */}
                        {isSelected ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                            <circle cx="7" cy="7" r="6" stroke="#3b82f6" strokeWidth="1.5"/>
                            <path d="M4.5 7L6.5 9L9.5 5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span
                            className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--color-text-3)' }}
                          >
                            Use
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* ── Footer link ────────────────────────────────────────── */}
              <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link
                  href="/dashboard/settings?tab=voice"
                  className="text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--color-text-3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
                >
                  Full voice settings &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
