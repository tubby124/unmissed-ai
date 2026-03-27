"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { trackEvent } from "@/lib/analytics"
import BorderBeam from "@/components/ui/border-beam"
import {
  WaveformBars,
  StatusBadge,
  CallTimer,
  TranscriptBubble,
  LiveClassificationTags,
  NotificationPreview,
  PostCallSummary,
  EndCallButton,
  createSoundCues,
  useClassificationTags,
  type AgentStatus,
  type TranscriptEntry,
} from "@/components/DemoCallVisuals"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"

// Lazy-load the SDK to avoid SSR issues (WebRTC is browser-only)
let UltravoxSession: typeof import("ultravox-client").UltravoxSession | null = null
let UltravoxSessionStatus: typeof import("ultravox-client").UltravoxSessionStatus | null = null

interface DemoCallProps {
  demoId: string
  callerName: string
  agentName: string
  companyName: string
  agentColor?: string
  extraBody?: Record<string, unknown>
  onEnd: () => void
}

type CallState = "idle" | "requesting" | "connecting" | "active" | "ended" | "error"

export default function DemoCall({ demoId, callerName, agentName, companyName, agentColor, extraBody, onEnd }: DemoCallProps) {
  const [callState, setCallState] = useState<CallState>("idle")
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle")
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [callId, setCallId] = useState<string | null>(null)
  const [energy, setEnergy] = useState(0.3)
  const [showNotification, setShowNotification] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [notificationIntent, setNotificationIntent] = useState<string | undefined>()

  const callStartRef = useRef<number>(0)
  const sessionRef = useRef<InstanceType<typeof import("ultravox-client").UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const soundRef = useRef<ReturnType<typeof createSoundCues> | null>(null)
  const notificationShownRef = useRef(false)
  const agentStatusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-scroll transcript within its container
  useEffect(() => {
    const container = transcriptContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [transcripts])

  // Simulated audio energy based on agent status
  useEffect(() => {
    if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)

    if (callState !== "active") {
      setEnergy(0.3)
      return
    }

    energyIntervalRef.current = setInterval(() => {
      setEnergy(() => {
        if (agentStatus === "speaking") return 0.6 + Math.random() * 0.4
        if (agentStatus === "listening") return 0.1 + Math.random() * 0.3
        return 0.3
      })
    }, 120)

    return () => {
      if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
    }
  }, [callState, agentStatus])

  // Classification tags from transcripts
  const onNewTag = useCallback(() => {
    soundRef.current?.tagPop()
    // Show notification toast on first HOT tag
    if (!notificationShownRef.current) {
      notificationShownRef.current = true
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
    }
  }, [])

  const classificationTags = useClassificationTags(transcripts, demoId, onNewTag)

  // Show notification at ~45s if no tag has triggered it yet
  useEffect(() => {
    if (callState === "active" && secondsLeft <= 75 && secondsLeft > 73 && !notificationShownRef.current) {
      notificationShownRef.current = true
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
    }
  }, [callState, secondsLeft])

  // Update notification intent from latest tag
  useEffect(() => {
    if (classificationTags.length > 0) {
      const latest = classificationTags[classificationTags.length - 1]
      setNotificationIntent(latest.label)
    }
  }, [classificationTags])

  // Countdown timer
  useEffect(() => {
    if (callState === "active") {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            handleEndCall()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState])

  const handleEndCall = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
    soundRef.current?.endTone()
    try {
      await sessionRef.current?.leaveCall()
    } catch {
      // ignore cleanup errors
    }
    sessionRef.current = null
    setCallState("ended")

    // Log demo end (fire-and-forget)
    if (callId) {
      const duration = callStartRef.current > 0 ? Math.round((Date.now() - callStartRef.current) / 1000) : 0
      trackEvent("demo_browser_end", { duration_seconds: duration })
      fetch("/api/demo/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, duration }),
      }).catch(() => {})
    }
  }, [callId])

  // Fetch AI summary when call ends
  useEffect(() => {
    if (callState !== "ended") return
    const finalTranscripts = transcripts.filter(t => t.isFinal)
    if (finalTranscripts.length < 2) return

    setSummaryLoading(true)
    const transcriptText = finalTranscripts
      .map(t => `${t.speaker === "agent" ? agentName : "Caller"}: ${t.text}`)
      .join("\n")

    fetch("/api/demo/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptText, demoId }),
    })
      .then(res => res.json())
      .then(data => setSummary(data.summary || null))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [callState, transcripts, demoId, agentName])

  const startCall = useCallback(async () => {
    // Cancel any previous in-flight call (React 18 Strict Mode double-mount fix)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCallState("requesting")
    setError(null)

    // Init sound cues
    if (!soundRef.current) {
      soundRef.current = createSoundCues()
    }

    try {
      // Lazy-load SDK
      if (!UltravoxSession) {
        const mod = await import("ultravox-client")
        UltravoxSession = mod.UltravoxSession
        UltravoxSessionStatus = mod.UltravoxSessionStatus
      }

      if (controller.signal.aborted) return

      // Request mic permission early
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // release immediately, SDK will request again

      if (controller.signal.aborted) return

      // Create demo call via API
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoId, callerName, ...extraBody }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to start demo" }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      if (controller.signal.aborted) return

      const { joinUrl, callId: newCallId } = await res.json()
      setCallId(newCallId)
      callStartRef.current = Date.now()

      if (controller.signal.aborted) return

      // Connect via WebRTC
      setCallState("connecting")
      const session = new UltravoxSession!()
      sessionRef.current = session

      session.addEventListener("status", () => {
        const status = session.status

        // Debounce agent status to prevent jitter during rapid turn-taking
        if (agentStatusDebounceRef.current) clearTimeout(agentStatusDebounceRef.current)
        agentStatusDebounceRef.current = setTimeout(() => {
          if (status === UltravoxSessionStatus!.SPEAKING) setAgentStatus("speaking")
          else if (status === UltravoxSessionStatus!.LISTENING) setAgentStatus("listening")
          else if (status === UltravoxSessionStatus!.THINKING) setAgentStatus("thinking")
          else setAgentStatus("idle")
        }, 150)

        // Call state transitions (not debounced)
        if (
          status === UltravoxSessionStatus!.IDLE ||
          status === UltravoxSessionStatus!.LISTENING ||
          status === UltravoxSessionStatus!.SPEAKING
        ) {
          setCallState(prev => {
            if (prev !== "active") {
              // First time hitting active — play connect chime
              soundRef.current?.connectChime()
            }
            return "active"
          })
        } else if (status === UltravoxSessionStatus!.DISCONNECTED) {
          setCallState("ended")
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })

      session.addEventListener("transcripts", () => {
        const allTranscripts = session.transcripts.map(t => ({
          speaker: t.speaker === "user" ? ("user" as const) : ("agent" as const),
          text: t.text,
          isFinal: t.isFinal,
        }))
        setTranscripts(allTranscripts)
      })

      session.joinCall(joinUrl)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setError("Microphone access is required. Please allow mic access and try again.")
      } else {
        setError(msg)
      }
      setCallState("error")
    }
  }, [demoId, callerName])

  // Start automatically on mount
  useEffect(() => {
    startCall()
    return () => {
      abortRef.current?.abort()
      sessionRef.current?.leaveCall().catch(() => {})
      if (timerRef.current) clearInterval(timerRef.current)
      if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
      if (agentStatusDebounceRef.current) clearTimeout(agentStatusDebounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const callDuration = callStartRef.current > 0 ? Math.round((Date.now() - callStartRef.current) / 1000) : 0

  return (
    <div className="w-full max-w-lg mx-auto relative">
      <AnimatePresence mode="wait">
        {/* ─── Loading / Connecting ─── */}
        {(callState === "requesting" || callState === "connecting") && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16 rounded-full overflow-hidden" role="img" aria-label="Connecting to agent">
                <VoicePoweredOrb externalEnergy={0.2} />
                <BorderBeam
                  size={100}
                  duration={callState === "connecting" ? 4 : 8}
                  colorFrom={agentColor || "#6366f1"}
                  colorTo="#a855f7"
                />
                {callState === "connecting" && [0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ border: `1px solid ${agentColor || "rgba(99,102,241,0.3)"}` }}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2, delay: i * 0.4, ease: "easeOut" }}
                  />
                ))}
              </div>
            </div>
            <motion.p
              className="text-lg font-semibold"
              style={{ color: "var(--color-text-1)" }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {callState === "requesting" ? "Setting up your demo..." : `Connecting to ${agentName}...`}
            </motion.p>
            <p className="text-sm mt-2" style={{ color: "var(--color-text-3)" }}>
              Make sure your microphone is enabled
            </p>
          </motion.div>
        )}

        {/* ─── Active Call ─── */}
        {callState === "active" && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            {/* Glassmorphism call card */}
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
              }}
            >
              {/* Header row: agent info + status + timer */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-text-1)" }}>
                    Talking to {agentName}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{companyName}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={agentStatus} callState="active" />
                  <CallTimer secondsLeft={secondsLeft} totalSeconds={300} />
                </div>
              </div>

              {/* WebGL Orb + Waveform center */}
              <div className="flex flex-col items-center gap-3 mb-5">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden" role="img" aria-label="Active call visualization">
                  <VoicePoweredOrb externalEnergy={energy} />
                </div>
                <WaveformBars
                  status={agentStatus}
                  energy={energy}
                  agentColor={agentColor}
                />
              </div>

              {/* Classification tags */}
              {classificationTags.length > 0 && (
                <div className="mb-3">
                  <LiveClassificationTags tags={classificationTags} />
                </div>
              )}

              {/* Transcript bubbles */}
              <div
                ref={transcriptContainerRef}
                className="h-48 sm:h-64 overflow-y-auto space-y-2 mb-4 px-1"
              >
                {transcripts.length === 0 && (
                  <p className="text-sm italic text-center pt-4" style={{ color: "var(--color-text-3)" }}>
                    Waiting for {agentName} to speak...
                  </p>
                )}
                {transcripts.map((t, i) => (
                  <TranscriptBubble
                    key={i}
                    entry={t}
                    agentName={agentName}
                    showLabel={i === 0 || transcripts[i - 1].speaker !== t.speaker}
                  />
                ))}
              </div>

              {/* End call button */}
              <EndCallButton onEnd={handleEndCall} />
            </div>

            {/* Notification toast — positioned outside the card */}
            <NotificationPreview
              show={showNotification}
              agentName={agentName}
              intent={notificationIntent}
            />
          </motion.div>
        )}

        {/* ─── Call Ended ─── */}
        {callState === "ended" && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PostCallSummary
              transcripts={transcripts}
              agentName={agentName}
              companyName={companyName}
              duration={callDuration}
              summary={summary}
              summaryLoading={summaryLoading}
              tags={classificationTags}
              callId={callId}
              demoId={demoId}
              isPreview={extraBody?.mode === "preview"}
              onEnd={onEnd}
            />
          </motion.div>
        )}

        {/* ─── Error ─── */}
        {callState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden opacity-50" role="img" aria-label="Call error">
                <VoicePoweredOrb externalEnergy={0.1} hue={0} />
              </div>
            </div>
            <p className="text-lg font-semibold mb-2" style={{ color: "#EF4444" }}>
              Could not start demo
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--color-text-3)" }}>{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setCallState("idle")
                  startCall()
                }}
                className="block w-full py-3 rounded-xl text-white font-semibold text-sm cursor-pointer"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Try Again
              </button>
              <button
                onClick={onEnd}
                className="block w-full py-3 rounded-xl font-medium text-sm cursor-pointer"
                style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-3)" }}
              >
                Back to agents
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
