'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Voice {
  voiceId: string
  name: string
  description: string
  provider: string
}

type Gender = 'all' | 'female' | 'male'

function inferGender(desc: string, name: string): 'female' | 'male' | 'unknown' {
  const d = desc.toLowerCase()
  const n = name.toLowerCase()
  if (d.includes('female') || d.includes('woman')) return 'female'
  if (d.includes('male') || d.includes(' man ') || d.includes(' man,') || d.includes(' man.')) return 'male'
  // Name-based heuristics for voices with sparse descriptions
  const femaleNames = ['monika', 'ashley', 'jacqueline', 'olivia', 'sarah', 'luna', 'deborah', 'hana', 'emily', 'tanya', 'claire', 'wendy', 'priya', 'pixie', 'julia', 'cassidy', 'noushin', 'paulina', 'cheyenne', 'louisamay', 'hannah', 'elizabeth', 'kai']
  const maleNames = ['mark', 'grant', 'shaun', 'blake', 'dennis', 'timothy', 'brandon', 'clive', 'arlo', 'matt', 'eanna', 'chris', 'carter', 'alex', 'craig', 'edward', 'hades', 'ronald', 'aaron', 'steve', 'muyiwa']
  if (femaleNames.some(f => n.includes(f))) return 'female'
  if (maleNames.some(m => n.includes(m))) return 'male'
  return 'unknown'
}

interface Props {
  selectedVoiceId: string | null
  onSelect: (voiceId: string) => void
}

export default function VoicePicker({ selectedVoiceId, onSelect }: Props) {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [gender, setGender] = useState<Gender>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/public/voices')
      .then(r => r.json())
      .then(data => setVoices(data.voices || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const play = useCallback((voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    const audio = new Audio(`/api/public/voice-preview/${voiceId}`)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
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

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const filtered = voices.filter(v => {
    if (gender === 'all') return true
    return inferGender(v.description, v.name) === gender
  })

  const genderTabs: { key: Gender; label: string }[] = [
    { key: 'all', label: 'All voices' },
    { key: 'female', label: 'Female' },
    { key: 'male', label: 'Male' },
  ]

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Gender filter */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 w-fit">
        {genderTabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setGender(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              gender === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Voice grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {filtered.map(voice => {
          const isSelected = selectedVoiceId === voice.voiceId
          const isPlaying = playingId === voice.voiceId

          return (
            <div
              key={voice.voiceId}
              onClick={() => onSelect(voice.voiceId)}
              className={`
                relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              {/* Play / stop button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  isPlaying ? stop() : play(voice.voiceId)
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isPlaying
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
                title={isPlaying ? 'Stop' : 'Play preview'}
              >
                {isPlaying ? (
                  <div className="flex items-end gap-px justify-center" style={{ width: 16, height: 12 }}>
                    {[0, 100, 200, 100, 0].map((delay, i) => (
                      <div
                        key={i}
                        style={{
                          width: 2,
                          height: 10,
                          borderRadius: 2,
                          background: 'white',
                          transformOrigin: 'bottom',
                          animation: `voiceBar 0.75s ease-in-out ${delay}ms infinite`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                    <path d="M0.5 0.5L9.5 6L0.5 11.5V0.5Z" />
                  </svg>
                )}
              </button>

              {/* Voice info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{voice.name}</span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-indigo-600">
                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4 7L6 9L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {voice.description && (
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{voice.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No voices match this filter</p>
      )}

      {/* Waveform animation keyframes */}
      <style>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
