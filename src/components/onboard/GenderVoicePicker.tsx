'use client'

import { useCallback, useRef, useState } from 'react'

// Canonical voice IDs
const JACQUELINE_ID = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a'
const MARK_ID = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae'

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

  const cards = [
    {
      id: JACQUELINE_ID,
      name: 'Jacqueline',
      gender: 'Female',
      description: 'Warm, friendly, empathetic',
      // Venus symbol ♀
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
          <circle cx="12" cy="9" r="5"/>
          <line x1="12" y1="14" x2="12" y2="21"/>
          <line x1="9" y1="18" x2="15" y2="18"/>
        </svg>
      ),
    },
    {
      id: MARK_ID,
      name: 'Mark',
      gender: 'Male',
      description: 'Clear, direct, professional',
      // Mars symbol ♂
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
          <circle cx="10" cy="13" r="5"/>
          <line x1="14.5" y1="8.5" x2="21" y2="2"/>
          <polyline points="16,2 21,2 21,7"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const isSelected = selectedVoiceId === card.id
          const isPlaying = playingId === card.id
          const hasError = errorId === card.id

          return (
            <div
              key={card.id}
              onClick={() => onSelect(card.id, card.name)}
              className={`
                relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 cursor-pointer transition-all
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
                  : 'border-border bg-card hover:border-border hover:bg-muted/30'
                }
              `}
            >
              {/* Gender icon */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isSelected ? 'bg-indigo-100' : 'bg-muted'
              }`}>
                {card.icon}
              </div>

              {/* Label */}
              <div className="text-center">
                <div className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-foreground'}`}>
                  {card.gender}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{card.description}</div>
              </div>

              {/* Preview button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  isPlaying ? stop() : play(card.id)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isPlaying
                    ? 'bg-indigo-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {isPlaying ? (
                  <>
                    <div className="flex items-end gap-0.5" style={{ height: 12 }}>
                      {[0, 100, 200].map((delay, i) => (
                        <div key={i} style={{
                          width: 2,
                          height: 10,
                          borderRadius: 2,
                          background: 'white',
                          transformOrigin: 'bottom',
                          animation: `voiceBar 0.75s ease-in-out ${delay}ms infinite`,
                        }} />
                      ))}
                    </div>
                    Stop
                  </>
                ) : (
                  <>
                    <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
                      <path d="M0 0L8 5L0 10V0Z"/>
                    </svg>
                    Preview
                  </>
                )}
              </button>

              {/* Error badge */}
              {hasError && (
                <span className="absolute top-2 right-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
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
        })}
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
