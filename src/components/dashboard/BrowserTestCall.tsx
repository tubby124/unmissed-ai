"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import {
  VoiceOrb, WaveformBars, StatusBadge as DemoStatusBadge,
  CallTimer, TranscriptBubble,
  createSoundCues,
} from "@/components/DemoCallVisuals"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import { useCallContext } from "@/contexts/CallContext"
import { usePathname } from "next/navigation"

// Re-export TranscriptEntry so existing consumers (Lab, etc.) don't break
export type { TranscriptEntry } from "@/components/DemoCallVisuals"

interface BrowserTestCallProps {
  joinUrl: string
  onEnd: (transcripts: import("@/components/DemoCallVisuals").TranscriptEntry[]) => void
}

const LAB_MAX_SECONDS = 180

export default function BrowserTestCall({ joinUrl, onEnd }: BrowserTestCallProps) {
  const pathname = usePathname()
  const {
    callState,
    agentStatus,
    transcripts,
    energy,
    error,
    startCall,
    endCall,
    setMeta,
  } = useCallContext()

  const [localSecondsLeft, setLocalSecondsLeft] = useState(LAB_MAX_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const soundCuesRef = useRef<ReturnType<typeof createSoundCues> | null>(null)
  const hasChimedRef = useRef(false)
  const hasEndedRef = useRef(false)
  // Own scroll ref — avoids collision with AgentTestCard's shared transcriptContainerRef
  const localTranscriptRef = useRef<HTMLDivElement | null>(null)
  // Keep a ref to transcripts so onEnd always gets the latest snapshot
  const transcriptsRef = useRef(transcripts)
  transcriptsRef.current = transcripts

  // Initialize sound cues
  useEffect(() => {
    soundCuesRef.current = createSoundCues()
  }, [])

  // Connect via CallContext on mount
  useEffect(() => {
    setMeta({ agentName: "Agent", businessName: "", sourceRoute: pathname })
    startCall(joinUrl)
  }, [joinUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play connect chime when call becomes active
  useEffect(() => {
    if (callState === "active" && !hasChimedRef.current) {
      hasChimedRef.current = true
      soundCuesRef.current?.connectChime()
    }
  }, [callState])

  // Local 180-second timer (Lab calls are shorter than dashboard's 300s)
  useEffect(() => {
    if (callState === "active") {
      timerRef.current = setInterval(() => {
        setLocalSecondsLeft(prev => {
          if (prev <= 1) { endCall(); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callState, endCall])

  // Auto-scroll local transcript container
  useEffect(() => {
    if (localTranscriptRef.current) localTranscriptRef.current.scrollTop = localTranscriptRef.current.scrollHeight
  }, [transcripts])

  // Fire onEnd callback when call ends — read latest transcripts via ref
  useEffect(() => {
    if ((callState === "ended" || callState === "error") && !hasEndedRef.current) {
      hasEndedRef.current = true
      if (timerRef.current) clearInterval(timerRef.current)
      soundCuesRef.current?.endTone()
      onEnd(transcriptsRef.current)
    }
  }, [callState, onEnd])

  // ── Error ─────────────────────────────────────────────────────────────────
  if (callState === "error") {
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <div className="flex flex-col items-center gap-3 py-2">
          <VoiceOrb status="idle" energy={0.1} agentColor="#EF4444" size="sm" />
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "#fca5a5" }}>Call failed</p>
            <p className="text-xs mt-1" style={{ color: "#f87171" }}>{error}</p>
          </div>
        </div>
        <button
          onClick={() => { if (!hasEndedRef.current) onEnd([]) }}
          className="w-full min-h-[44px] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (callState === "idle" || callState === "requesting" || callState === "connecting") {
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex flex-col items-center gap-3 py-4">
          <VoiceOrb status="idle" energy={0.2} size="sm" connecting={callState === "connecting"} />
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>Connecting...</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>Allow mic access if prompted</p>
          </div>
        </div>
        <div className="rounded-xl p-3 h-32 space-y-3" style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
          {[75, 50, 66].map((w, i) => (
            <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: "linear-gradient(90deg, var(--color-border) 25%, var(--color-hover) 50%, var(--color-border) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Ended ─────────────────────────────────────────────────────────────────
  if (callState === "ended") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
        >
          <svg className="w-4 h-4" style={{ color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
        <span className="text-sm" style={{ color: "var(--color-text-2)" }}>Call ended — results saved above.</span>
      </motion.div>
    )
  }

  // ── Active — WebGL VoicePoweredOrb ────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(16,185,129,0.04))",
        border: "1px solid rgba(99,102,241,0.15)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header: status badge + timer */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <DemoStatusBadge status={agentStatus} callState="active" />
        <CallTimer secondsLeft={localSecondsLeft} totalSeconds={LAB_MAX_SECONDS} />
      </div>

      {/* Center: WebGL VoicePoweredOrb + WaveformBars */}
      <div className="flex flex-col items-center gap-3 py-3 px-4">
        <div className="w-24 h-24 sm:w-28 sm:h-28">
          <VoicePoweredOrb externalEnergy={energy} />
        </div>
        <WaveformBars status={agentStatus} energy={energy} />
      </div>

      {/* Transcript bubbles */}
      <div
        ref={localTranscriptRef}
        className="h-40 overflow-y-auto space-y-2 px-4 py-2"
        aria-live="polite"
        aria-label="Call transcript"
      >
        {transcripts.length === 0 && (
          <p className="text-xs italic text-center pt-4" style={{ color: "var(--color-text-3)" }}>Waiting for agent to speak...</p>
        )}
        {transcripts.map((t, i) => {
          const prevSpeaker = i > 0 ? transcripts[i - 1].speaker : null
          return (
            <TranscriptBubble
              key={i}
              entry={t}
              agentName="Agent"
              showLabel={t.speaker !== prevSpeaker}
            />
          )
        })}
      </div>

      {/* End call button */}
      <div className="px-4 pb-4 pt-2">
        <button
          onClick={endCall}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all text-white flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: "#DC2626", minHeight: "48px" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          End Call
        </button>
      </div>
    </motion.div>
  )
}
