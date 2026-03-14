"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"

// Lazy-load the SDK to avoid SSR issues (WebRTC is browser-only)
let UltravoxSession: typeof import("ultravox-client").UltravoxSession | null = null
let UltravoxSessionStatus: typeof import("ultravox-client").UltravoxSessionStatus | null = null

interface DemoCallProps {
  demoId: string
  callerName: string
  agentName: string
  companyName: string
  onEnd: () => void
}

interface TranscriptEntry {
  speaker: "user" | "agent"
  text: string
  isFinal: boolean
}

type CallState = "idle" | "requesting" | "connecting" | "active" | "ended" | "error"

export default function DemoCall({ demoId, callerName, agentName, companyName, onEnd }: DemoCallProps) {
  const [callState, setCallState] = useState<CallState>("idle")
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(120)
  const sessionRef = useRef<InstanceType<typeof import("ultravox-client").UltravoxSession> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript within its container (not the whole page)
  useEffect(() => {
    const container = transcriptContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [transcripts])

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
    try {
      await sessionRef.current?.leaveCall()
    } catch {
      // ignore cleanup errors
    }
    sessionRef.current = null
    setCallState("ended")
  }, [])

  const startCall = useCallback(async () => {
    setCallState("requesting")
    setError(null)

    try {
      // Lazy-load SDK
      if (!UltravoxSession) {
        const mod = await import("ultravox-client")
        UltravoxSession = mod.UltravoxSession
        UltravoxSessionStatus = mod.UltravoxSessionStatus
      }

      // Request mic permission early
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // release immediately, SDK will request again

      // Create demo call via API
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoId, callerName }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to start demo" }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const { joinUrl } = await res.json()

      // Connect via WebRTC
      setCallState("connecting")
      const session = new UltravoxSession!()
      sessionRef.current = session

      session.addEventListener("status", () => {
        const status = session.status
        if (status === UltravoxSessionStatus!.IDLE || status === UltravoxSessionStatus!.LISTENING || status === UltravoxSessionStatus!.SPEAKING) {
          setCallState("active")
        } else if (status === UltravoxSessionStatus!.DISCONNECTED) {
          setCallState("ended")
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })

      session.addEventListener("transcripts", () => {
        const allTranscripts = session.transcripts.map(t => ({
          speaker: t.speaker === "user" ? "user" as const : "agent" as const,
          text: t.text,
          isFinal: t.isFinal,
        }))
        setTranscripts(allTranscripts)
      })

      session.joinCall(joinUrl)
    } catch (err) {
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
      sessionRef.current?.leaveCall().catch(() => {})
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  return (
    <div className="w-full max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {/* Loading / Connecting */}
        {(callState === "requesting" || callState === "connecting") && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">
              {callState === "requesting" ? "Setting up your demo..." : `Connecting to ${agentName}...`}
            </p>
            <p className="text-gray-500 text-sm mt-2">Make sure your microphone is enabled</p>
          </motion.div>
        )}

        {/* Active Call */}
        {callState === "active" && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold">Talking to {agentName}</p>
                <p className="text-gray-500 text-xs">{companyName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400">{formatTime(secondsLeft)}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Transcript */}
            <div
              ref={transcriptContainerRef}
              className="rounded-xl p-4 mb-4 h-64 overflow-y-auto space-y-3"
              style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
            >
              {transcripts.length === 0 && (
                <p className="text-gray-600 text-sm italic">Waiting for {agentName} to speak...</p>
              )}
              {transcripts.map((t, i) => (
                <div
                  key={i}
                  className={`text-sm ${t.speaker === "agent" ? "text-blue-400" : "text-gray-300"} ${!t.isFinal ? "opacity-60" : ""}`}
                >
                  <span className="text-gray-600 text-xs mr-2">{t.speaker === "agent" ? agentName : "You"}</span>
                  {t.text}
                </div>
              ))}
            </div>

            {/* End button */}
            <button
              onClick={handleEndCall}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors text-white"
              style={{ backgroundColor: "#DC2626" }}
            >
              End Demo Call
            </button>
          </motion.div>
        )}

        {/* Call Ended */}
        {callState === "ended" && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#1a1a2e" }}>
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Demo complete</h3>
            <p className="text-gray-400 mb-6">
              That&apos;s exactly what your customers would hear.
              {agentName} answered the phone, collected info, and would have notified you instantly.
            </p>

            {/* Transcript summary */}
            {transcripts.filter(t => t.isFinal).length > 0 && (
              <div
                className="rounded-xl p-4 mb-6 text-left h-40 overflow-y-auto"
                style={{ backgroundColor: "#111111", border: "1px solid #1F1F1F" }}
              >
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Call transcript</p>
                {transcripts.filter(t => t.isFinal).map((t, i) => (
                  <div key={i} className={`text-sm mb-1 ${t.speaker === "agent" ? "text-blue-400" : "text-gray-300"}`}>
                    <span className="text-gray-600 text-xs mr-2">{t.speaker === "agent" ? agentName : "You"}</span>
                    {t.text}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <Link
                href="/onboard"
                className="block w-full py-4 rounded-xl text-white font-semibold text-sm transition-colors text-center"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Get My Agent Set Up →
              </Link>
              <button
                onClick={onEnd}
                className="block w-full py-3 rounded-xl text-gray-400 font-medium text-sm transition-colors hover:text-white"
                style={{ backgroundColor: "#1A1A1A" }}
              >
                Try a different agent
              </button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {callState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-red-400 text-lg font-semibold mb-2">Could not start demo</p>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => { setCallState("idle"); startCall() }}
                className="block w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Try Again
              </button>
              <button
                onClick={onEnd}
                className="block w-full py-3 rounded-xl text-gray-400 font-medium text-sm hover:text-white"
                style={{ backgroundColor: "#1A1A1A" }}
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
