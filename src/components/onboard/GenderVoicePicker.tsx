'use client'

import { useCallback, useRef, useState } from 'react'

interface VoiceOption {
  id: string
  name: string
  gender: 'Female' | 'Male'
  personality: string
}

const VOICES: VoiceOption[] = [
  // Female voices
  { id: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', name: 'Jacqueline', gender: 'Female', personality: 'Warm, friendly, empathetic' },
  { id: '87edb04c-06d4-47c2-bd94-683bc47e8fbe', name: 'Monika', gender: 'Female', personality: 'Energetic, confident, upbeat' },
  { id: 'df0b14d7-945f-41b2-989a-7c8c57688ddf', name: 'Ashley', gender: 'Female', personality: 'Calm, professional, reassuring' },
  // Male voices
  { id: 'b0e6b5c1-3100-44d5-8578-9015aa3023ae', name: 'Mark', gender: 'Male', personality: 'Clear, direct, professional' },
  { id: 'd766b9e3-69df-4727-b62f-cd0b6772c2ad', name: 'Nour', gender: 'Male', personality: 'Warm, patient, trustworthy' },
  { id: '7d0bcff3-77ec-48ea-83d6-40ca0095e80c', name: 'Terrence', gender: 'Male', personality: 'Confident, authoritative, steady' },
]

const FEMALE_VOICES = VOICES.filter(v => v.gender === 'Female')
const MALE_VOICES = VOICES.filter(v => v.gender === 'Male')

interface Props {
  selectedVoiceId: string | null
  onSelect: (voiceId: string, voiceName: string) => void
}

export default function GenderVoicePicker({ selectedVoiceId, onSelect }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback((voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setErrorId(null)
    const audio = new Audio(`/api/public/voice-preview/${voiceId}`)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => {
      setPlayingId(null)
      setErrorId(voiceId)
      setTimeout(() => setErrorId(v => v === voiceId ? null : v), 3000)
    }
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(voiceId)
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingId(null)
  }, [])

  function renderVoiceCard(voice: VoiceOption) {
    const isSelected = selectedVoiceId === voice.id
    const isPlaying = playingId === voice.id
    const hasError = errorId === voice.id

    return (
      <div
        key={voice.id}
        onClick={() => {
          onSelect(voice.id, voice.name)
          isPlaying ? stop() : play(voice.id)
        }}
        className={`
          relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all
          ${isSelected
            ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
            : 'border-border bg-card hover:border-border hover:bg-muted/30'
          }
        `}
      >
        {/* Voice name + personality */}
        <div className="text-center">
          <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-foreground'}`}>
            {voice.name}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{voice.personality}</div>
        </div>

        {/* Play indicator: waveform when playing, muted play icon when idle */}
        <div className="flex items-center justify-center h-5">
          {isPlaying ? (
            <div className="flex items-end gap-0.5">
              {[0, 100, 200].map((delay, i) => (
                <div key={i} style={{
                  width: 2,
                  height: 10,
                  borderRadius: 2,
                  background: '#4f46e5',
                  transformOrigin: 'bottom',
                  animation: `voiceBar 0.75s ease-in-out ${delay}ms infinite`,
                }} />
              ))}
            </div>
          ) : (
            <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" className="text-muted-foreground/30">
              <path d="M0 0L8 5L0 10V0Z"/>
            </svg>
          )}
        </div>

        {/* Error badge — top-left to avoid overlap with selected checkmark */}
        {hasError && (
          <span className="absolute top-2 left-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Preview unavailable
          </span>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Female voices */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Female</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FEMALE_VOICES.map(renderVoiceCard)}
        </div>
      </div>

      {/* Male voices */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Male</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MALE_VOICES.map(renderVoiceCard)}
        </div>
      </div>

      <p className="text-xs text-muted-foreground/70 text-center">More voices available in your dashboard after setup.</p>

      <style>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
