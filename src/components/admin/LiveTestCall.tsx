"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { WaveformBars, createSoundCues, type AgentStatus } from '@/components/DemoCallVisuals'
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"

// Lazy-load SDK to avoid SSR issues (WebRTC is browser-only)
let UltravoxSession: typeof import("ultravox-client").UltravoxSession | null = null
let UltravoxSessionStatus: typeof import("ultravox-client").UltravoxSessionStatus | null = null

interface TranscriptEntry {
  speaker: "user" | "agent"
  text: string
  isFinal: boolean
}

interface LiveTestCallProps {
  joinUrl: string
  onEnd: () => void
}

export default function LiveTestCall({ joinUrl, onEnd }: LiveTestCallProps) {
  const [status, setStatus] = useState<"connecting" | "active" | "ended" | "error">("connecting")
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [secondsLeft, setSecondsLeft] = useState(180)
  const [error, setError] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [energy, setEnergy] = useState(0.15)
  const sessionRef = useRef<InstanceType<typeof import("ultravox-client").UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const soundCuesRef = useRef<ReturnType<typeof createSoundCues> | null>(null)
  const hasChimedRef = useRef(false)

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
  }, [])

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
        // Lazy load SDK
        if (!UltravoxSession) {
          const mod = await import("ultravox-client")
          UltravoxSession = mod.UltravoxSession
          UltravoxSessionStatus = mod.UltravoxSessionStatus
        }

        if (cancelled) return

        // Request mic permission
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
          }

          // Map SDK status to AgentStatus
          if (s === UltravoxSessionStatus!.SPEAKING) setAgentStatus('speaking')
          else if (s === UltravoxSessionStatus!.LISTENING) setAgentStatus('listening')
          else setAgentStatus('idle')
        })

        session.addEventListener("transcripts", () => {
          setTranscripts(
            session.transcripts.map(t => ({
              speaker: t.speaker === "user" ? "user" as const : "agent" as const,
              text: t.text,
              isFinal: t.isFinal,
            }))
          )
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

  // ── Error state ──────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="text-xs text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
        <p className="font-medium">Call failed</p>
        <p>{error}</p>
        <button
          onClick={onEnd}
          className="text-red-700 font-semibold underline cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    )
  }

  // ── Connecting state ─────────────────────────────────────────────────────
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700">
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Connecting... allow mic access if prompted
      </div>
    )
  }

  // ── Ended state ──────────────────────────────────────────────────────────
  if (status === "ended") {
    const finalTranscripts = transcripts.filter(t => t.isFinal)
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-600 font-medium">Call ended</span>
          <button
            onClick={onEnd}
            className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
        {finalTranscripts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
            {finalTranscripts.map((t, i) => (
              <p
                key={i}
                className={`text-xs ${t.speaker === "agent" ? "text-indigo-600" : "text-gray-600"}`}
              >
                <span className="text-gray-400 mr-1 font-medium">
                  {t.speaker === "agent" ? "Agent:" : "You:"}
                </span>
                {t.text}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Active call ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-medium text-emerald-700">Live — speak into your mic</span>
        </div>
        <span className="font-mono text-gray-400">{formatTime(secondsLeft)}</span>
      </div>

      {/* WebGL VoicePoweredOrb + WaveformBars visual centerpiece */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="w-16 h-16 rounded-full overflow-hidden" role="img" aria-label="Active call orb">
          <VoicePoweredOrb externalEnergy={energy} />
        </div>
        <WaveformBars status={agentStatus} energy={energy} />
      </div>

      <div
        ref={containerRef}
        className="bg-white border border-gray-200 rounded-lg p-3 h-32 overflow-y-auto space-y-1"
      >
        {transcripts.length === 0 && (
          <p className="text-xs text-gray-400 italic">Waiting for agent to speak...</p>
        )}
        {transcripts.map((t, i) => (
          <p
            key={i}
            className={`text-xs ${t.speaker === "agent" ? "text-indigo-600" : "text-gray-600"} ${!t.isFinal ? "opacity-50" : ""}`}
          >
            <span className="text-gray-400 mr-1 font-medium">
              {t.speaker === "agent" ? "Agent:" : "You:"}
            </span>
            {t.text}
          </p>
        ))}
      </div>

      <button
        onClick={endCall}
        className="w-full text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors cursor-pointer"
      >
        End Call
      </button>
    </div>
  )
}
