'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ClientConfig } from '@/app/dashboard/settings/page'

export const PROVIDER_COLORS: Record<string, string> = {
  Cartesia: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Eleven Labs': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Inworld: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

export interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl: string
  languageLabel: string
}

interface VoicePickerProps {
  client: ClientConfig
  isAdmin: boolean
}

export default function VoicePicker({ client, isAdmin }: VoicePickerProps) {
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

  return (
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
  )
}
