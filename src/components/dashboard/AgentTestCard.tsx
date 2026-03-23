"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Phone, Mic, AlertCircle, RotateCcw, ArrowRight, BookOpen, Bell } from "lucide-react"
import {
  VoiceOrb,
  WaveformBars,
  StatusBadge,
  CallTimer,
  TranscriptBubble,
  EndCallButton,
  type AgentStatus,
  type TranscriptEntry,
} from "@/components/DemoCallVisuals"
import { useUltravoxCall, type CallState } from "@/hooks/useUltravoxCall"
import { useOnboarding } from "@/hooks/useOnboarding"
import { trackEvent } from "@/lib/analytics"

interface AgentTestCardProps {
  agentName: string
  businessName: string
  clientStatus: string | null
}

export default function AgentTestCard({ agentName, businessName, clientStatus }: AgentTestCardProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [returnedCallId, setReturnedCallId] = useState<string | null>(null)
  const { incrementTestCalls, isStepComplete } = useOnboarding()
  const hasRecordedCallEnd = useRef(false)

  const {
    callState,
    agentStatus,
    transcripts,
    energy,
    secondsLeft,
    error: hookError,
    startCall,
    endCall,
    transcriptContainerRef,
  } = useUltravoxCall({ maxSeconds: 300 })

  const handleStartTest = useCallback(async () => {
    setIsRequesting(true)
    setApiError(null)
    trackEvent('agent_test_start')

    try {
      const res = await fetch("/api/dashboard/agent-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to start test" }))
        if (res.status === 429) {
          setApiError(`Too many test calls. Try again in ${data.retryAfterSeconds || 30}s.`)
        } else {
          setApiError(data.error || `HTTP ${res.status}`)
        }
        setIsRequesting(false)
        return
      }

      const { joinUrl, callId } = await res.json()
      setReturnedCallId(callId)
      await startCall(joinUrl)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error")
    } finally {
      setIsRequesting(false)
    }
  }, [startCall])

  const handleRetry = useCallback(() => {
    setApiError(null)
    setReturnedCallId(null)
    handleStartTest()
  }, [handleStartTest])

  // Auto-complete "meet_agent" checklist step when test call ends
  useEffect(() => {
    if (callState === "ended" && !hasRecordedCallEnd.current) {
      hasRecordedCallEnd.current = true
      incrementTestCalls()
    }
    if (callState === "idle") {
      hasRecordedCallEnd.current = false
    }
  }, [callState, incrementTestCalls])

  // Derive display state from both API request + hook state
  const displayState: "idle" | "loading" | "active" | "ended" | "error" =
    apiError ? "error" :
    isRequesting ? "loading" :
    callState === "requesting" || callState === "connecting" ? "loading" :
    callState === "active" ? "active" :
    callState === "ended" ? "ended" :
    callState === "error" ? "error" :
    "idle"

  const isTrial = clientStatus === "trial"
  const errorMsg = apiError || hookError

  return (
    <div id="agent-test-card" className="mb-6">
      <AnimatePresence mode="wait">
        {/* ─── Idle: CTA Card ─── */}
        {displayState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-5 sm:p-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(99,102,241,0.15)" }}
              >
                <Mic className="w-5 h-5" style={{ color: "#818cf8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base" style={{ color: "var(--color-text-1)" }}>
                  Test Your Agent
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--color-text-3)" }}>
                  Talk to {agentName} right from your browser. Hear how it greets callers and handles conversations with your business context.
                </p>
                <button
                  onClick={handleStartTest}
                  className="mt-4 px-5 py-2.5 rounded-xl text-white font-medium text-sm cursor-pointer inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <Phone className="w-4 h-4" />
                  Start Test Call
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Loading / Connecting ─── */}
        {displayState === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl p-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-center py-6">
              <div className="flex justify-center mb-5">
                <VoiceOrb
                  status="idle"
                  energy={0.3}
                  size="sm"
                  connecting={callState === "connecting"}
                />
              </div>
              <motion.p
                className="text-base font-semibold"
                style={{ color: "var(--color-text-1)" }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {callState === "connecting" ? `Connecting to ${agentName}...` : "Setting up your test call..."}
              </motion.p>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-3)" }}>
                Make sure your microphone is enabled
              </p>
            </div>
          </motion.div>
        )}

        {/* ─── Active Call ─── */}
        {displayState === "active" && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--color-text-1)" }}>
                  Talking to {agentName}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-3)" }}>{businessName}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <StatusBadge status={agentStatus} callState="active" />
                <CallTimer secondsLeft={secondsLeft} totalSeconds={300} />
              </div>
            </div>

            {/* Orb + Waveform */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <VoiceOrb status={agentStatus} energy={energy} size="md" />
              <WaveformBars status={agentStatus} energy={energy} />
            </div>

            {/* Transcript */}
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

            <EndCallButton onEnd={endCall} />
          </motion.div>
        )}

        {/* ─── Call Ended ─── */}
        {displayState === "ended" && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 sm:p-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Transcript review */}
            <h3 className="font-semibold text-base mb-3" style={{ color: "var(--color-text-1)" }}>
              Test Call Complete
            </h3>

            {transcripts.filter(t => t.isFinal).length > 0 && (
              <div className="h-48 sm:h-56 overflow-y-auto space-y-2 mb-4 px-1 rounded-xl p-3"
                style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                {transcripts.filter(t => t.isFinal).map((t, i) => (
                  <TranscriptBubble
                    key={i}
                    entry={t}
                    agentName={agentName}
                    showLabel={i === 0 || transcripts.filter(x => x.isFinal)[i - 1]?.speaker !== t.speaker}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                onClick={handleRetry}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm cursor-pointer inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-2)" }}
              >
                <RotateCcw className="w-4 h-4" />
                Test Again
              </button>

              {isTrial && (
                <a
                  href="/dashboard/settings?tab=billing"
                  className="flex-1 py-2.5 rounded-xl text-white font-medium text-sm inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Get a Phone Number
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* What's Next guidance — only show incomplete steps */}
            {(!isStepComplete("train_agent") || !isStepComplete("setup_alerts") || isTrial) && (
              <div
                className="mt-4 rounded-xl p-3 space-y-2"
                style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--color-text-3)" }}>
                  What&apos;s next
                </p>
                {!isStepComplete("train_agent") && (
                  <a
                    href="/dashboard/settings?tab=knowledge"
                    className="flex items-center gap-2.5 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-2)" }}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: "#a78bfa" }} />
                    Add FAQs and service info to improve responses
                  </a>
                )}
                {!isStepComplete("setup_alerts") && (
                  <a
                    href="/dashboard/settings?tab=notifications"
                    className="flex items-center gap-2.5 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-2)" }}
                  >
                    <Bell className="w-3.5 h-3.5 shrink-0" style={{ color: "#f59e0b" }} />
                    Connect Telegram for instant call alerts
                  </a>
                )}
                {isTrial && (
                  <a
                    href="/dashboard/settings?tab=billing"
                    className="flex items-center gap-2.5 py-1.5 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: "var(--color-text-2)" }}
                  >
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#818cf8" }} />
                    Get a phone number so real callers reach your agent
                  </a>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Error ─── */}
        {displayState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-5 sm:p-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
              <div className="flex-1">
                <p className="font-medium text-sm" style={{ color: "#EF4444" }}>
                  Could not start test call
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--color-text-3)" }}>
                  {errorMsg}
                </p>
                <button
                  onClick={handleRetry}
                  className="mt-3 px-4 py-2 rounded-xl font-medium text-sm cursor-pointer inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
