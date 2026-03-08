'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioWaveformPlayerProps {
  callId: string
  onTimeUpdate?: (currentTime: number) => void
}

// Generate deterministic waveform bars from callId seed
function generateBars(seed: string, count = 60): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin(hash * (i + 1) * 0.3) * 0.5 + 0.5
    return 0.25 + n * 0.75
  })
}

export default function AudioWaveformPlayer({ callId, onTimeUpdate }: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const bars = generateBars(callId)

  const progress = duration > 0 ? currentTime / duration : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => setLoading(false)
    const onError = () => { setLoading(false); setError(true) }
    const onDuration = () => setDuration(audio.duration || 0)
    const onTime = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime)
    }
    const onEnded = () => setPlaying(false)

    audio.addEventListener('canplay', onLoaded)
    audio.addEventListener('error', onError)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('canplay', onLoaded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [onTimeUpdate])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setError(true))
    }
  }, [playing])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = ratio * duration
  }, [duration])

  function fmtTime(s: number) {
    if (!isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  function handleBarClick(i: number) {
    seek(i / bars.length)
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width)
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Recording</p>
        <p className="text-zinc-600 text-sm">Recording unavailable or still processing.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Recording</p>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={`/api/dashboard/calls/${callId}/recording`}
        preload="metadata"
        className="hidden"
      />

      {/* Controls row */}
      <div className="flex items-center gap-4 mb-4">
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M5 3l14 9-14 9V3z"/>
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Time */}
        <span className="text-xs font-mono text-zinc-500 shrink-0 tabular-nums">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>

        {/* Download */}
        <a
          href={`/api/dashboard/calls/${callId}/recording`}
          download={`call-${callId.slice(0, 8)}.mp3`}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Download recording"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>

      {/* Waveform bars */}
      <div className="flex items-end gap-px h-12 cursor-pointer">
        {bars.map((height, i) => {
          const barProgress = i / bars.length
          const active = barProgress <= progress
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${active ? 'bg-blue-500' : 'bg-white/10'}`}
              style={{ height: `${height * 100}%` }}
              onClick={() => handleBarClick(i)}
            />
          )
        })}
      </div>
    </div>
  )
}

// Export seekTo helper for external control
export function createAudioController(audioRef: React.RefObject<HTMLAudioElement | null>) {
  return {
    seekTo(time: number) {
      if (audioRef.current) audioRef.current.currentTime = time
    }
  }
}
