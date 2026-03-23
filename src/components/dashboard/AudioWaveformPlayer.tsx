'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioWaveformPlayerProps {
  callId: string
  recordingUrl?: string
  onTimeUpdate?: (currentTime: number) => void
}

const BAR_COUNT = 80
const ACCENT = '#007AFF'

// Extract real waveform peaks from decoded audio buffer
function extractPeaks(buffer: AudioBuffer, barCount: number): number[] {
  const channel = buffer.getChannelData(0)
  const samplesPerBar = Math.floor(channel.length / barCount)
  const peaks: number[] = []

  for (let i = 0; i < barCount; i++) {
    let max = 0
    const start = i * samplesPerBar
    const end = Math.min(start + samplesPerBar, channel.length)
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j])
      if (abs > max) max = abs
    }
    peaks.push(max)
  }

  // Normalize to 0-1 range
  const maxPeak = Math.max(...peaks, 0.01)
  return peaks.map(p => Math.max(0.08, p / maxPeak))
}

// Fallback: deterministic bars from callId when audio can't be decoded
function generateFallbackBars(seed: string, count: number): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return Array.from({ length: count }, (_, i) => {
    const n = Math.sin(hash * (i + 1) * 0.3) * 0.5 + 0.5
    return 0.15 + n * 0.85
  })
}

function fmtTime(s: number) {
  if (!isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function AudioWaveformPlayer({ callId, recordingUrl, onTimeUpdate }: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [peaks, setPeaks] = useState<number[]>(() => generateFallbackBars(callId, BAR_COUNT))
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const progress = duration > 0 ? currentTime / duration : 0
  const audioUrl = recordingUrl || `/api/dashboard/calls/${callId}/recording`

  // Decode audio and extract real waveform peaks
  useEffect(() => {
    let cancelled = false
    const ctx = new AudioContext()

    fetch(audioUrl)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.arrayBuffer()
      })
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        if (!cancelled) setPeaks(extractPeaks(decoded, BAR_COUNT))
      })
      .catch(() => {
        // Keep fallback bars — not a fatal error
      })
      .finally(() => ctx.close())

    return () => { cancelled = true }
  }, [audioUrl])

  // Audio element event listeners
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
    const onSeekEvent = (e: Event) => {
      const time = (e as CustomEvent<{ time: number }>).detail.time
      if (isFinite(time)) audio.currentTime = time
    }

    audio.addEventListener('canplay', onLoaded)
    audio.addEventListener('error', onError)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    document.addEventListener('audio-seek', onSeekEvent)

    return () => {
      audio.removeEventListener('canplay', onLoaded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
      document.removeEventListener('audio-seek', onSeekEvent)
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

  // Click anywhere on waveform to seek
  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width)
  }

  // Hover tracking for preview
  function handleWaveformMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setHoveredBar(Math.floor(ratio * BAR_COUNT))
  }

  if (error) {
    return (
      <div className="rounded-2xl p-5 card-surface">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4 t3">Recording</p>
        <p className="text-sm" style={{ color: "var(--color-text-3)" }}>Recording unavailable or still processing.</p>
      </div>
    )
  }

  const currentBar = Math.floor(progress * BAR_COUNT)

  return (
    <div className="rounded-2xl p-5 card-surface">
      {/* Header row: label + time + download */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Recording</p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums" style={{ color: "var(--color-text-3)" }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
          <a
            href={audioUrl}
            download={`call-${callId.slice(0, 8)}.mp3`}
            className="transition-colors hover:opacity-70"
            style={{ color: "var(--color-text-3)" }}
            title="Download recording"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />

      {/* Play button + waveform row */}
      <div className="flex items-center gap-4">
        {/* Play/pause button */}
        <button
          onClick={togglePlay}
          disabled={loading}
          className="w-11 h-11 rounded-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0 hover:scale-105 active:scale-95"
          style={{ backgroundColor: ACCENT }}
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
              <path d="M6 3l14 9-14 9V3z"/>
            </svg>
          )}
        </button>

        {/* Waveform — this IS the scrubber */}
        <div
          ref={waveformRef}
          className="flex-1 flex items-center gap-[2px] h-14 cursor-pointer relative"
          onClick={handleWaveformClick}
          onMouseMove={handleWaveformMove}
          onMouseLeave={() => setHoveredBar(null)}
        >
          {peaks.map((peak, i) => {
            const played = i < currentBar
            const isCurrent = i === currentBar && playing
            const isHovered = hoveredBar !== null && i <= hoveredBar

            let color: string
            if (played) {
              color = ACCENT
            } else if (isHovered) {
              color = `${ACCENT}66` // 40% opacity preview
            } else {
              color = 'rgba(255,255,255,0.12)'
            }

            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{
                  height: `${peak * 100}%`,
                  minHeight: 3,
                  backgroundColor: color,
                  boxShadow: isCurrent ? `0 0 8px ${ACCENT}80` : undefined,
                  transform: isCurrent ? 'scaleY(1.15)' : undefined,
                  transition: 'background-color 75ms, transform 150ms ease, box-shadow 150ms ease',
                }}
              />
            )
          })}

          {/* Playhead line */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-[2px] rounded-full pointer-events-none transition-none"
              style={{
                left: `${progress * 100}%`,
                backgroundColor: ACCENT,
                boxShadow: playing ? `0 0 6px ${ACCENT}80` : undefined,
              }}
            />
          )}
        </div>
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
