"use client"

import { useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { PhoneOff, ArrowUpRight } from "lucide-react"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import { useCallContext } from "@/contexts/CallContext"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function FloatingCallOrb() {
  const { callState, energy, secondsLeft, meta, isMinimized, endCall } = useCallContext()
  const router = useRouter()
  const wasShowingRef = useRef(false)

  const handleReturn = useCallback(() => {
    if (meta?.sourceRoute) router.push(meta.sourceRoute)
  }, [meta, router])

  const handleEnd = useCallback(async () => {
    await endCall()
  }, [endCall])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  // Track when PiP was visible so we can toast on call end
  const isShowing = isMinimized && callState !== "idle" && callState !== "ended"

  useEffect(() => {
    if (isShowing) {
      wasShowingRef.current = true
    }
    if (callState === "ended" && wasShowingRef.current) {
      wasShowingRef.current = false
      toast("Test call ended", {
        description: `Call with ${meta?.agentName ?? "your agent"} has finished.`,
        duration: 4000,
      })
    }
    if (callState === "idle") {
      wasShowingRef.current = false
    }
  }, [callState, isShowing, meta])

  // Only render when call is active AND user navigated away
  if (!isShowing) return null

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        role="status"
        aria-label={`Active call with ${meta?.agentName ?? "Agent"} — ${formatTime(secondsLeft)} remaining`}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl cursor-pointer max-w-[calc(100vw-3rem)]"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.15)",
        }}
        onClick={handleReturn}
      >
        {/* Mini WebGL orb + pulse ring */}
        <div className="relative flex-shrink-0 w-12 h-12">
          <div className="w-full h-full rounded-full overflow-hidden">
            <VoicePoweredOrb externalEnergy={energy} />
          </div>
          {/* Pulse ring — outside overflow-hidden so scale animation isn't clipped */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: "2px solid rgba(16,185,129,0.4)" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold truncate t1">
            {meta?.agentName ?? "Agent"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-mono text-green-400">{formatTime(secondsLeft)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
          {/* Return to call */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReturn() }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: "var(--color-hover)" }}
            aria-label="Return to call"
          >
            <ArrowUpRight className="w-3.5 h-3.5 t2" />
          </button>

          {/* End call */}
          <button
            onClick={(e) => { e.stopPropagation(); handleEnd() }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 transition-colors"
            aria-label="End call"
          >
            <PhoneOff className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )

  // Portal to body to ensure it renders above everything
  if (typeof document === "undefined") return null
  return createPortal(content, document.body)
}
