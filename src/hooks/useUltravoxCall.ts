"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { AgentStatus, TranscriptEntry } from "@/components/DemoCallVisuals"

// Lazy-load the SDK to avoid SSR issues (WebRTC is browser-only)
let UltravoxSession: typeof import("ultravox-client").UltravoxSession | null = null
let UltravoxSessionStatus: typeof import("ultravox-client").UltravoxSessionStatus | null = null

export type CallState = "idle" | "requesting" | "connecting" | "active" | "ended" | "error"

interface UseUltravoxCallOptions {
  /** Max call duration in seconds. Default: 120 */
  maxSeconds?: number
}

interface UseUltravoxCallReturn {
  callState: CallState
  agentStatus: AgentStatus
  transcripts: TranscriptEntry[]
  energy: number
  secondsLeft: number
  error: string | null
  /** Begin requesting mic + connecting. Caller must provide joinUrl. */
  startCall: (joinUrl: string) => Promise<void>
  /** Gracefully end the call. */
  endCall: () => Promise<void>
  /** Reset all state back to idle. */
  resetToIdle: () => void
  /** Ref for the transcript scroll container. */
  transcriptContainerRef: React.RefObject<HTMLDivElement | null>
}

export function useUltravoxCall(opts?: UseUltravoxCallOptions): UseUltravoxCallReturn {
  const maxSeconds = opts?.maxSeconds ?? 120

  const [callState, setCallState] = useState<CallState>("idle")
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle")
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [energy, setEnergy] = useState(0.3)
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds)
  const [error, setError] = useState<string | null>(null)

  const sessionRef = useRef<InstanceType<typeof import("ultravox-client").UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const energyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const agentStatusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null)
  const endCallRef = useRef<() => Promise<void>>(async () => {})

  // Auto-scroll transcript
  useEffect(() => {
    const container = transcriptContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [transcripts])

  // Energy simulation
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

  // Countdown timer
  useEffect(() => {
    if (callState === "active") {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            endCallRef.current()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  const endCall = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
    try {
      await sessionRef.current?.leaveCall()
    } catch {
      // ignore cleanup errors
    }
    sessionRef.current = null
    setCallState("ended")
  }, [])

  const resetToIdle = useCallback(() => {
    setCallState("idle")
    setAgentStatus("idle")
    setTranscripts([])
    setError(null)
    setEnergy(0.3)
    setSecondsLeft(maxSeconds)
  }, [maxSeconds])

  // Keep endCallRef in sync for timer callback
  useEffect(() => {
    endCallRef.current = endCall
  }, [endCall])

  const startCall = useCallback(async (joinUrl: string) => {
    // Cancel any previous in-flight call (React 18 Strict Mode)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Disconnect any existing session before starting a new one
    if (sessionRef.current) {
      try { await sessionRef.current.leaveCall() } catch { /* cleanup */ }
      sessionRef.current = null
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    setCallState("requesting")
    setError(null)
    setTranscripts([])
    setSecondsLeft(maxSeconds)

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
      stream.getTracks().forEach(t => t.stop())

      if (controller.signal.aborted) return

      // Connect via WebRTC
      setCallState("connecting")
      const session = new UltravoxSession!()
      sessionRef.current = session

      session.addEventListener("status", () => {
        const status = session.status

        // Debounce agent status to prevent jitter
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
          setCallState(prev => (prev !== "active" ? "active" : prev))
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
  }, [maxSeconds])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      sessionRef.current?.leaveCall().catch(() => {})
      if (timerRef.current) clearInterval(timerRef.current)
      if (energyIntervalRef.current) clearInterval(energyIntervalRef.current)
      if (agentStatusDebounceRef.current) clearTimeout(agentStatusDebounceRef.current)
    }
  }, [])

  return {
    callState,
    agentStatus,
    transcripts,
    energy,
    secondsLeft,
    error,
    startCall,
    endCall,
    resetToIdle,
    transcriptContainerRef,
  }
}
