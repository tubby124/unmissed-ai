'use client'

/**
 * VoicePickerCompact — Go Live tab Section 3: Voice.
 *
 * Spec: docs/superpowers/specs/2026-04-26-go-live-tab-design.md §5.3
 *
 * Three rules:
 *   1. Working previews only — voices in EXPERIMENTAL_VOICES are filtered out;
 *      remaining voices are intersected with GO_LIVE_VOICES (curated catalog
 *      from src/lib/voice-presets.ts).
 *   2. Real scrollable list — Female/Male filter chips at top; vertical
 *      scrollable list below; per-row ▶ play button + name + vibe + ✓ check.
 *   3. Switching is a moment — selected row pulses; sample auto-plays on
 *      selection; transient "{Name} is now answering your calls" banner
 *      slides in below the list and dismisses on next interaction or 8s.
 *
 * Save: this component is controlled — the parent receives `onSelect(voiceId)`
 * and is responsible for calling usePatchSettings({ agent_voice_id }).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { EXPERIMENTAL_VOICES, GO_LIVE_VOICES, type GoLiveVoice } from '@/lib/voice-presets'

type GenderFilter = 'female' | 'male'

interface Props {
  currentVoiceId: string | null
  onSelect: (voiceId: string) => void
}

export default function VoicePickerCompact({ currentVoiceId, onSelect }: Props) {
  // Visible voices = curated GO_LIVE_VOICES minus EXPERIMENTAL_VOICES.
  const visibleVoices = useMemo(
    () => GO_LIVE_VOICES.filter(v => !EXPERIMENTAL_VOICES.includes(v.voiceId)),
    []
  )

  // Default filter: gender of the current voice, fallback to Female.
  const initialFilter: GenderFilter = useMemo(() => {
    const current = visibleVoices.find(v => v.voiceId === currentVoiceId)
    return current?.gender === 'male' ? 'male' : 'female'
  }, [currentVoiceId, visibleVoices])

  const [filter, setFilter] = useState<GenderFilter>(initialFilter)
  const filteredVoices = useMemo(
    () => visibleVoices.filter(v => v.gender === filter),
    [visibleVoices, filter]
  )

  // Audio playback — single shared instance, stopped before play.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  const playVoice = useCallback((voiceId: string) => {
    const a = audioRef.current
    if (a) {
      a.onended = null
      a.onerror = null
      a.pause()
      a.src = ''
    }
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null)
      return
    }
    const audio = new Audio(`/api/dashboard/voices/${voiceId}/preview`)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audio.play().catch(() => setPlayingVoiceId(null))
    audioRef.current = audio
    setPlayingVoiceId(voiceId)
  }, [playingVoiceId])

  // Cleanup on unmount.
  useEffect(() => () => {
    const a = audioRef.current
    if (a) { a.onended = null; a.onerror = null; a.pause() }
  }, [])

  // ── "Switching is a moment" — pulse + auto-play + transient banner ─────
  const [pulseVoiceId, setPulseVoiceId] = useState<string | null>(null)
  const [bannerVoice, setBannerVoice] = useState<GoLiveVoice | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSelect = useCallback((voice: GoLiveVoice) => {
    if (voice.voiceId === currentVoiceId) return
    onSelect(voice.voiceId)
    // Pulse the row for 200ms.
    setPulseVoiceId(voice.voiceId)
    setTimeout(() => {
      setPulseVoiceId(prev => (prev === voice.voiceId ? null : prev))
    }, 220)
    // Auto-play the sample once.
    // Stop any current playback first, then start the new one.
    const a = audioRef.current
    if (a) { a.onended = null; a.onerror = null; a.pause(); a.src = '' }
    const audio = new Audio(`/api/dashboard/voices/${voice.voiceId}/preview`)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audio.play().catch(() => setPlayingVoiceId(null))
    audioRef.current = audio
    setPlayingVoiceId(voice.voiceId)
    // Transient banner.
    setBannerVoice(voice)
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    bannerTimerRef.current = setTimeout(() => setBannerVoice(null), 8000)
  }, [currentVoiceId, onSelect])

  // Dismiss banner on any interaction outside the row click.
  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
    setBannerVoice(null)
  }, [])

  useEffect(() => () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
  }, [])

  return (
    <section className="space-y-4" aria-labelledby="go-live-voice-heading">
      <h2 id="go-live-voice-heading" className="sr-only">Voice</h2>

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-5">
        {/* Filter chips */}
        <div role="tablist" aria-label="Voice gender filter" className="flex gap-2 mb-4">
          {(['female', 'male'] as const).map(g => {
            const active = filter === g
            return (
              <button
                key={g}
                role="tab"
                aria-selected={active}
                onClick={() => { setFilter(g); dismissBanner() }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {g === 'female' ? 'Female' : 'Male'}
              </button>
            )
          })}
        </div>

        {/* Scrollable voice list */}
        <ul
          role="listbox"
          aria-label="Available voices"
          className="overflow-y-auto max-h-[60vh] -mx-2 px-2 space-y-1"
        >
          {filteredVoices.map(v => {
            const selected = v.voiceId === currentVoiceId
            const isPlaying = playingVoiceId === v.voiceId
            const isPulsing = pulseVoiceId === v.voiceId
            return (
              <li key={v.voiceId} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => handleSelect(v)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                    selected
                      ? 'bg-zinc-900/[0.04]'
                      : 'hover:bg-zinc-50'
                  } ${isPulsing ? 'ring-2 ring-zinc-900/30' : ''}`}
                >
                  {/* Play button (left) */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={isPlaying ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
                    onClick={e => { e.stopPropagation(); dismissBanner(); playVoice(v.voiceId) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        dismissBanner()
                        playVoice(v.voiceId)
                      }
                    }}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {isPlaying ? (
                      <span className="flex items-end gap-px" style={{ width: 12, height: 10 }} aria-hidden="true">
                        {[0, 120, 240].map((d, i) => (
                          <span
                            key={i}
                            style={{
                              width: 2,
                              height: 9,
                              background: 'currentColor',
                              borderRadius: 1,
                              transformOrigin: 'bottom',
                              animation: `voiceBar 0.75s ease-in-out ${d}ms infinite`,
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      <svg width="10" height="11" viewBox="0 0 7 8" fill="currentColor" aria-hidden="true">
                        <path d="M0 0.5L7 4L0 7.5V0.5Z" />
                      </svg>
                    )}
                  </span>

                  {/* Name + vibe (middle) */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-zinc-900 truncate">{v.name}</span>
                    <span className="block text-xs text-zinc-500 truncate">{v.vibe}</span>
                  </span>

                  {/* Selected check (right) */}
                  {selected && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-zinc-900 shrink-0" aria-label="Selected">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
          {filteredVoices.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">
              No {filter} voices in this catalog.
            </li>
          )}
        </ul>
      </div>

      {/* Transient banner — "{Voice} is now answering your calls" */}
      <AnimatePresence>
        {bannerVoice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 shadow-sm"
          >
            <p className="text-sm text-zinc-900">
              <strong className="font-semibold">{bannerVoice.name}</strong>
              {' '}is now answering your calls. Tap below to hear how
              {' '}{bannerVoice.gender === 'male' ? 'he' : 'she'} sounds on a real call.
            </p>
            <div className="mt-2 flex justify-center text-zinc-400" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local keyframes for the playing animation. */}
      <style jsx global>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.3); }
          50%      { transform: scaleY(1); }
        }
      `}</style>
    </section>
  )
}
