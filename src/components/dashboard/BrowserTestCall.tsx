"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  VoiceOrb, WaveformBars, StatusBadge as DemoStatusBadge,
  CallTimer, TranscriptBubble, EndCallButton,
  createSoundCues, type AgentStatus
} from "@/components/DemoCallVisuals"

// Lazy-load SDK to avoid SSR issues (WebRTC is browser-only)
let UltravoxSession: typeof import("ultravox-client").UltravoxSession | null = null
let UltravoxSessionStatus: typeof import("ultravox-client").UltravoxSessionStatus | null = null

export interface TranscriptEntry {
  speaker: "user" | "agent"
  text: string
  isFinal: boolean
}

interface BrowserTestCallProps {
  joinUrl: string
  onEnd: (transcripts: TranscriptEntry[]) => void
}

export default function BrowserTestCall({ joinUrl, onEnd }: BrowserTestCallProps) {
  const [status, setStatus] = useState<"connecting" | "active" | "ended" | "error">("connecting")
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [secondsLeft, setSecondsLeft] = useState(180)
  const [error, setError] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [energy, setEnergy] = useState(0.15)
  const sessionRef = useRef<InstanceType<typeof import("ultravox-client").UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptsRef = useRef<TranscriptEntry[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const soundCuesRef = useRef<ReturnType<typeof createSoundCues> | null>(null)
  const hasChimedRef = useRef(false)

  // Keep ref in sync for use in endCall callback
  useEffect(() => { transcriptsRef.current = transcripts }, [transcripts])

  // Auto-scroll transcript
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [transcripts])

  // Initialize sound cues
  useEffect(() => {
    soundCuesRef.current = createSoundCues()
  }, [])

  // Energy simulation
  useEffect(() => {
    const id = setInterval(() => {
      setEnergy(() => {
        switch (agentStatus) {
          case 'speaking': return Math.random() * 0.4 + 0.6
          case 'listening': return Math.random() * 0.3 + 0.1
          case 'thinking': return 0.3
          default: return 0.15
        }
      })
    }, 120)
    return () => clearInterval(id)
  }, [agentStatus])

  const endCall = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    try { await sessionRef.current?.leaveCall() } catch { /* cleanup */ }
    sessionRef.current = null
    setStatus("ended")
    soundCuesRef.current?.endTone()
    onEnd(transcriptsRef.current)
  }, [onEnd])

  // Countdown timer
  useEffect(() => {
    if (status === "active") {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) { endCall(); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status, endCall])

  // Connect on mount
  useEffect(() => {
    let cancelled = false

    async function connect() {
      try {
        if (!UltravoxSession) {
          const mod = await import("ultravox-client")
          UltravoxSession = mod.UltravoxSession
          UltravoxSessionStatus = mod.UltravoxSessionStatus
        }

        if (cancelled) return

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())

        if (cancelled) return

        const session = new UltravoxSession!()
        sessionRef.current = session

        session.addEventListener("status", () => {
          const s = session.status
          if (
            s === UltravoxSessionStatus!.IDLE ||
            s === UltravoxSessionStatus!.LISTENING ||
            s === UltravoxSessionStatus!.SPEAKING
          ) {
            setStatus("active")
            if (!hasChimedRef.current) {
              hasChimedRef.current = true
              soundCuesRef.current?.connectChime()
            }
          } else if (s === UltravoxSessionStatus!.DISCONNECTED) {
            setStatus("ended")
            if (timerRef.current) clearInterval(timerRef.current)
            onEnd(transcriptsRef.current)
          }

          // Map SDK status → agentStatus
          if (s === UltravoxSessionStatus!.SPEAKING) setAgentStatus('speaking')
          else if (s === UltravoxSessionStatus!.LISTENING) setAgentStatus('listening')
          else if (s === UltravoxSessionStatus!.THINKING) setAgentStatus('thinking')
          else setAgentStatus('idle')
        })

        session.addEventListener("transcripts", () => {
          const entries: TranscriptEntry[] = session.transcripts.map(t => ({
            speaker: t.speaker === "user" ? "user" as const : "agent" as const,
            text: t.text,
            isFinal: t.isFinal,
          }))
          setTranscripts(entries)
        })

        session.joinCall(joinUrl)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(
          msg.includes("Permission denied") || msg.includes("NotAllowedError")
            ? "Microphone access required. Allow mic access and try again."
            : msg
        )
        setStatus("error")
      }
    }

    connect()

    return () => {
      cancelled = true
      sessionRef.current?.leaveCall().catch(() => {})
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [joinUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === "error") {
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
          onClick={() => onEnd([])}
          className="w-full min-h-[44px] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (status === "connecting") {
    return (
      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex flex-col items-center gap-3 py-4">
          <VoiceOrb status="idle" energy={0.2} size="sm" connecting={true} />
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
  if (status === "ended") {
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

  // ── Active ────────────────────────────────────────────────────────────────
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
        <CallTimer secondsLeft={secondsLeft} totalSeconds={180} />
      </div>

      {/* Center: VoiceOrb + WaveformBars */}
      <div className="flex flex-col items-center gap-3 py-3 px-4">
        <VoiceOrb status={agentStatus} energy={energy} size="md" />
        <WaveformBars status={agentStatus} energy={energy} />
      </div>

      {/* Transcript bubbles */}
      <div
        ref={containerRef}
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
