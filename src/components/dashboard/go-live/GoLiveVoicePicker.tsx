'use client'

/**
 * GoLiveVoicePicker — Go Live voice section.
 *
 * Replaces the curated GO_LIVE_VOICES catalog (6 voices) with the full
 * Ultravox English catalog from /api/dashboard/voices, rendered as a
 * 2-column grid with per-row preview playback and a search box.
 *
 * Why full catalog: user feedback (2026-04-27) — the curated 6-voice list
 * felt artificially small. They want to listen to and pick from the whole
 * catalog from this page, not just the onboarding subset.
 *
 * Search covers name + description + provider so "female", "warm",
 * "professional", or a specific name all work without needing a
 * gender-typed metadata field (the Ultravox API doesn't expose one).
 *
 * Controlled component: the parent owns onSelect → patch({ agent_voice_id }).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UltravoxVoice {
  voiceId: string
  name: string
  description?: string
  provider?: string
}

interface Props {
  currentVoiceId: string | null
  onSelect: (voiceId: string) => void
}

export default function GoLiveVoicePicker({ currentVoiceId, onSelect }: Props) {
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/voices')
      .then(r => r.json())
      .then((d: { voices?: UltravoxVoice[] }) => {
        if (cancelled) return
        setVoices(d.voices ?? [])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    const a = audioRef.current
    if (a) { a.onended = null; a.onerror = null; a.pause() }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return voices
    return voices.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.description ?? '').toLowerCase().includes(q) ||
      (v.provider ?? '').toLowerCase().includes(q)
    )
  }, [voices, search])

  const visible = showAll ? filtered : filtered.slice(0, 12)
  const hasMore = filtered.length > visible.length

  const playVoice = useCallback((vid: string) => {
    const a = audioRef.current
    if (a) {
      a.onended = null
      a.onerror = null
      a.pause()
      a.src = ''
    }
    if (playingVoiceId === vid) {
      setPlayingVoiceId(null)
      return
    }
    const audio = new Audio(`/api/dashboard/voices/${vid}/preview`)
    audio.onended = () => setPlayingVoiceId(null)
    audio.onerror = () => setPlayingVoiceId(null)
    audio.play().catch(() => setPlayingVoiceId(null))
    audioRef.current = audio
    setPlayingVoiceId(vid)
  }, [playingVoiceId])

  return (
    <section className="space-y-4" aria-labelledby="go-live-voice-heading">
      <h3 id="go-live-voice-heading" className="sr-only">Voice</h3>

      <div className="rounded-3xl border border-zinc-100 bg-white shadow-sm p-5 space-y-4">
        <div>
          <p className="text-base font-semibold text-zinc-900">Voice</p>
          <p className="text-sm text-zinc-600 mt-0.5">
            Pick how your agent sounds. Tap to listen — tap a card to set it.
          </p>
        </div>

        <input
          type="search"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowAll(false) }}
          placeholder="Search by name, vibe, or accent…"
          className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading voices…</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No voices match &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <ul
            role="listbox"
            aria-label="Available voices"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            {visible.map(v => {
              const selected = v.voiceId === currentVoiceId
              const isPlaying = playingVoiceId === v.voiceId
              return (
                <li key={v.voiceId} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => onSelect(v.voiceId)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors border ${
                      selected
                        ? 'border-zinc-900 bg-zinc-900/[0.03]'
                        : 'border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={isPlaying ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
                      onClick={e => { e.stopPropagation(); playVoice(v.voiceId) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          playVoice(v.voiceId)
                        }
                      }}
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isPlaying
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {isPlaying ? (
                        <span className="flex items-end gap-px" style={{ width: 11, height: 9 }} aria-hidden="true">
                          {[0, 120, 240].map((d, i) => (
                            <span
                              key={i}
                              style={{
                                width: 2,
                                height: 8,
                                background: 'currentColor',
                                borderRadius: 1,
                                transformOrigin: 'bottom',
                                animation: `goLiveVoiceBar 0.75s ease-in-out ${d}ms infinite`,
                              }}
                            />
                          ))}
                        </span>
                      ) : (
                        <svg width="9" height="10" viewBox="0 0 7 8" fill="currentColor" aria-hidden="true">
                          <path d="M0 0.5L7 4L0 7.5V0.5Z" />
                        </svg>
                      )}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-900 truncate">{v.name}</span>
                        {selected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-900 shrink-0" aria-label="Selected">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {v.description && (
                        <span className="block text-xs text-zinc-500 line-clamp-2">{v.description}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Show all {filtered.length} voices
          </button>
        )}
      </div>

      <style jsx global>{`
        @keyframes goLiveVoiceBar {
          0%, 100% { transform: scaleY(0.3); }
          50%      { transform: scaleY(1); }
        }
      `}</style>
    </section>
  )
}
