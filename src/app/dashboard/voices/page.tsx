'use client'

import { useEffect, useRef, useState } from 'react'

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  primaryLanguage: string
  languageLabel: string
  provider: 'Cartesia' | 'Eleven Labs' | 'Inworld'
  previewUrl: string
}

interface Client {
  id: string
  slug: string
  business_name: string
  agent_voice_id: string | null
  ultravox_agent_id: string | null
}

type UseVoiceState = 'idle' | 'loading' | 'done'

type Provider = 'All' | 'Cartesia' | 'Eleven Labs' | 'Inworld'

const PROVIDER_COLORS: Record<string, string> = {
  Cartesia: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Eleven Labs': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Inworld: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3" style={{
      background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-hover) 50%, var(--color-surface) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/[0.06] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 rounded bg-white/[0.06]" />
          <div className="h-3 w-20 rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-white/[0.04]" />
      <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
    </div>
  )
}

function VoiceCard({
  voice,
  clients,
  isAdmin,
  isPlaying,
  myVoiceId,
  myPreviousVoiceId,
  onPlay,
  onStop,
  onUseVoice,
}: {
  voice: UltravoxVoice
  clients: Client[]
  isAdmin: boolean
  isPlaying: boolean
  myVoiceId: string | null
  myPreviousVoiceId: string | null
  onPlay: (voiceId: string, previewUrl: string) => void
  onStop: () => void
  onUseVoice: (voiceId: string) => Promise<void>
}) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignedMap, setAssignedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    clients.forEach(c => { if (c.agent_voice_id === voice.voiceId) m[c.id] = true })
    return m
  })
  const [useVoiceState, setUseVoiceState] = useState<UseVoiceState>('idle')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isMyActiveVoice = !isAdmin && myVoiceId === voice.voiceId
  const isMyPreviousVoice = !isAdmin && !isMyActiveVoice && myPreviousVoiceId === voice.voiceId

  // Close dropdown on outside click
  useEffect(() => {
    if (!assignOpen) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAssignOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [assignOpen])

  const assignedClients = clients.filter(c => assignedMap[c.id])

  async function assign(clientId: string) {
    setAssigning(clientId)
    try {
      const res = await fetch('/api/dashboard/voices/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.voiceId, clientId }),
      })
      if (res.ok) {
        setAssignedMap(prev => ({ ...prev, [clientId]: true }))
      }
    } finally {
      setAssigning(null)
      setAssignOpen(false)
    }
  }

  async function handleUseVoice() {
    if (isMyActiveVoice || useVoiceState !== 'idle') return
    setUseVoiceState('loading')
    await onUseVoice(voice.voiceId)
    setUseVoiceState('done')
  }

  return (
    <div
      className={`group relative rounded-2xl border p-5 transition-all duration-200 ${
        isPlaying
          ? 'border-blue-500/40 bg-blue-500/[0.04]'
          : isMyActiveVoice
          ? 'border-green-500/20 bg-white/[0.02] hover:border-green-500/30 hover:bg-white/[0.04]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
      }`}
      style={isMyActiveVoice ? { borderBottomColor: 'rgba(34,197,94,0.4)', borderBottomWidth: 2 } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Play button */}
        <button
          onClick={() => (isPlaying ? onStop() : onPlay(voice.voiceId, voice.previewUrl))}
          className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
            isPlaying
              ? 'bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)]'
              : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.12] hover:text-white'
          }`}
          title={isPlaying ? 'Stop preview' : 'Play preview'}
        >
          {isPlaying ? (
            /* Animated waveform bars — scaleY from bottom, GPU-composited */
            <div className="flex items-end gap-px justify-center" style={{ width: 20, height: 16 }}>
              {[0, 120, 240, 120, 0].map((delay, i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    height: 14,
                    borderRadius: 2,
                    background: 'white',
                    transformOrigin: 'bottom',
                    willChange: 'transform',
                    animation: `voiceBar 0.75s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </div>
          ) : (
            /* Play icon */
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <path d="M1 1.5L11 7L1 12.5V1.5Z"/>
            </svg>
          )}
        </button>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{voice.name}</span>
            {(assignedClients.length > 0 || isMyActiveVoice) && (
              <span className="text-[9px] font-medium text-green-400 bg-green-500/15 border border-green-500/20 rounded-full px-1.5 py-0.5 leading-none shrink-0">
                {isMyActiveVoice ? 'Assigned' : 'Active'}
              </span>
            )}
            {isMyPreviousVoice && (
              <span className="text-[10px] font-medium text-zinc-500 bg-white/[0.03] border border-white/[0.06] rounded-full px-1.5 py-0.5 leading-none shrink-0">
                Previously used
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-zinc-500">{voice.languageLabel}</span>
            <span className="text-zinc-700">·</span>
            <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 leading-none ${PROVIDER_COLORS[voice.provider] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
              {voice.provider}
            </span>
          </div>
        </div>

        {/* Use This Voice — non-admin owners */}
        {!isAdmin && (
          <div className="shrink-0">
            {isMyActiveVoice || useVoiceState === 'done' ? (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Active
              </span>
            ) : (
              <button
                onClick={handleUseVoice}
                disabled={useVoiceState === 'loading'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 transition-colors border border-blue-500/20 disabled:opacity-50"
              >
                {useVoiceState === 'loading' ? (
                  <div className="w-3 h-3 rounded-full border border-blue-400/40 border-t-blue-300 animate-spin" />
                ) : null}
                {useVoiceState === 'loading' ? 'Saving…' : 'Use This Voice'}
              </button>
            )}
          </div>
        )}

        {/* Assign button — admin only */}
        {isAdmin && (
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setAssignOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white transition-colors border border-white/[0.06]"
            >
              Assign
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {assignOpen && clients.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 z-20 w-48 rounded-xl border border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Assign to agent</span>
                </div>
                {clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => assign(client.id)}
                    disabled={assigning === client.id}
                    className="flex items-center justify-between w-full px-3 py-2.5 text-left text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <span className="truncate">{client.business_name}</span>
                    {assignedMap[client.id] ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-green-400">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : assigning === client.id ? (
                      <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-zinc-300 animate-spin shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {voice.description ? (
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed line-clamp-2">
          {voice.description}
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-600 leading-relaxed italic">
          No description available
        </p>
      )}

      {/* Assigned client tags */}
      {assignedClients.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {assignedClients.map(c => (
            <span key={c.id} className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5">
              {c.business_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [myVoiceId, setMyVoiceId] = useState<string | null>(null)
  const [myPreviousVoiceId, setMyPreviousVoiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState<Provider>('All')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(data => {
        setVoices(data.voices || [])
        setClients(data.clients || [])
        setIsAdmin(data.isAdmin || false)
        setMyVoiceId(data.myVoiceId ?? null)
        setMyPreviousVoiceId(data.myPreviousVoiceId ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function useVoice(voiceId: string) {
    const res = await fetch('/api/dashboard/voices/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId }),
    })
    if (res.ok) {
      setMyPreviousVoiceId(myVoiceId)
      setMyVoiceId(voiceId)
    }
  }

  function playVoice(voiceId: string, previewUrl: string) {
    if (audioRef.current) {
      audioRef.current.onended = null  // clear BEFORE src change — prevents stale onerror firing
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    const url = previewUrl || `/api/dashboard/voices/${voiceId}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingId(voiceId)
  }

  function stopVoice() {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingId(null)
  }

  // Cleanup on unmount
  useEffect(() => () => { audioRef.current?.pause() }, [])

  const providers: Provider[] = ['All', 'Cartesia', 'Eleven Labs', 'Inworld']

  const filtered = voices.filter(v => {
    const matchProvider = provider === 'All' || v.provider === provider
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(search.toLowerCase())
    return matchProvider && matchSearch
  })

  const providerCounts: Record<Provider, number> = {
    All: voices.length,
    Cartesia: voices.filter(v => v.provider === 'Cartesia').length,
    'Eleven Labs': voices.filter(v => v.provider === 'Eleven Labs').length,
    Inworld: voices.filter(v => v.provider === 'Inworld').length,
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Voice Library</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {loading ? 'Loading...' : isAdmin
            ? `${voices.length} English voices from Ultravox — click to preview, assign to any agent`
            : `${voices.length} English voices — preview any voice, then click "Use This Voice" to activate it`
          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search voices..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-colors"
          />
        </div>

        {/* Provider filter tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {providers.map(p => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                provider === p
                  ? 'bg-white/[0.1] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p}
              {!loading && (
                <span className={`ml-1.5 text-[10px] ${provider === p ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {providerCounts[p]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!loading && search && (
        <p className="text-xs text-zinc-600 mb-4">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{search}&quot;
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">No voices match your filters</p>
          <button
            onClick={() => { setSearch(''); setProvider('All') }}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(voice => (
            <VoiceCard
              key={voice.voiceId}
              voice={voice}
              clients={clients}
              isAdmin={isAdmin}
              isPlaying={playingId === voice.voiceId}
              myVoiceId={myVoiceId}
              myPreviousVoiceId={myPreviousVoiceId}
              onPlay={(id, url) => playVoice(id, url)}
              onStop={stopVoice}
              onUseVoice={useVoice}
            />
          ))}
        </div>
      )}
    </div>
  )
}
