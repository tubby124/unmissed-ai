'use client'

import { useState, useRef, useEffect } from 'react'
import type { VoiceTabVoice } from './constants'
import { PROVIDER_COLORS } from './VoicePicker'

interface Props {
  agentVoiceId: string
  isAdmin: boolean
}

export default function AgentCurrentVoiceCard({ agentVoiceId, isAdmin }: Props) {
  const [voices, setVoices] = useState<VoiceTabVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then(d => setVoices(d.voices || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function playVoice(vid: string, previewUrl: string) {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (playingId === vid) { setPlayingId(null); return }
    const url = previewUrl || `/api/dashboard/voices/${vid}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(vid)
  }

  const currentVoice = voices.find(v => v.voiceId === agentVoiceId)

  return (
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      <div className="p-5 border-b b-theme">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Current Voice</p>
        <p className="text-[11px] t3">The voice your callers hear when they reach your agent.</p>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-hover animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 rounded bg-hover animate-pulse" />
              <div className="h-3 w-44 rounded bg-hover animate-pulse" />
            </div>
          </div>
        ) : currentVoice ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => playVoice(currentVoice.voiceId, currentVoice.previewUrl)}
              className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 group cursor-pointer transition-all hover:border-indigo-400/50 hover:shadow-[0_0_16px_rgba(99,102,241,0.15)]"
              aria-label={playingId === currentVoice.voiceId ? 'Stop preview' : 'Play voice preview'}
            >
              {playingId === currentVoice.voiceId ? (
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

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <p className="text-sm font-semibold t1 truncate">{currentVoice.name}</p>
                {isAdmin && (
                  <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                    PROVIDER_COLORS[currentVoice.provider] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'
                  }`}>
                    {currentVoice.provider}
                  </span>
                )}
              </div>
              <p className="text-[11px] t3 leading-relaxed line-clamp-2">{currentVoice.description || 'No description available'}</p>
            </div>
          </div>
        ) : agentVoiceId ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-hover border b-theme flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="t3">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium t2">Custom Voice</p>
              <p className="text-[10px] font-mono t3 truncate max-w-[200px]">{agentVoiceId}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-amber-400/90">No voice selected yet. Browse the Voice Library to choose one.</span>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t b-theme bg-page flex items-center justify-between">
        <p className="text-[10px] t3">
          {playingId === currentVoice?.voiceId ? 'Playing preview...' : 'Click the avatar to hear a preview'}
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
  )
}
