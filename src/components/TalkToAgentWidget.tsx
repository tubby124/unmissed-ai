"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { X, Mic } from "lucide-react"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import DemoCall from "./DemoCall"

type WidgetStep = "closed" | "call"

const EXCLUDED_PREFIXES = ["/dashboard", "/onboard", "/admin", "/api", "/login"]

export default function TalkToAgentWidget() {
  const pathname = usePathname()
  const [step, setStep] = useState<WidgetStep>("closed")
  const [showPulse, setShowPulse] = useState(true)

  // Stop pulse after 8s
  useEffect(() => {
    const t = setTimeout(() => setShowPulse(false), 8000)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => setStep("closed"), [])

  // Escape key to close
  useEffect(() => {
    if (step !== "call") return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [step, close])

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (step === "call") {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [step])

  if (EXCLUDED_PREFIXES.some(p => pathname.startsWith(p))) return null

  function open() {
    setShowPulse(false)
    setStep("call")
  }

  return (
    <>
      {/* ── Floating button ── */}
      <AnimatePresence>
        {step === "closed" && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={open}
            aria-label="Talk to Zara, our AI agent"
            className="fixed bottom-24 left-5 md:bottom-5 z-50 flex items-center gap-2.5 rounded-full text-white text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: "var(--color-primary)",
              padding: "14px 20px",
              boxShadow: "0 4px 24px rgba(79,70,229,0.45), 0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            {/* Pulse ring */}
            {showPulse && (
              <span
                className="absolute inset-0 rounded-full animate-ping pointer-events-none"
                style={{ backgroundColor: "var(--color-primary)", opacity: 0.25 }}
              />
            )}

            {/* Mini orb as icon */}
            <span className="relative w-5 h-5 rounded-full overflow-hidden shrink-0">
              <VoicePoweredOrb externalEnergy={showPulse ? 0.3 : 0.1} />
            </span>

            <span className="relative hidden sm:inline whitespace-nowrap">Talk to Zara</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Full-screen call overlay ── */}
      <AnimatePresence>
        {step === "call" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={e => { if (e.target === e.currentTarget) close() }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Drag handle — mobile */}
              <div className="sm:hidden flex justify-center pt-2">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
              </div>

              {/* Header */}
              <div
                className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-5 sm:pt-4"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <VoicePoweredOrb externalEnergy={0.4} />
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{ color: "var(--color-text-1)" }}
                    >
                      Zara
                    </p>
                    <p
                      className="text-[10px] font-mono"
                      style={{ color: "var(--color-text-3)" }}
                    >
                      unmissed.ai demo agent
                    </p>
                  </div>
                </div>
                <button
                  onClick={close}
                  className="p-2 rounded-full transition-colors cursor-pointer"
                  style={{ color: "var(--color-text-3)" }}
                  aria-label="Close demo"
                >
                  <X size={16} />
                </button>
              </div>

              {/* DemoCall — auto-starts on mount */}
              <div className="px-3 pb-5 sm:px-4 pt-2">
                <DemoCall
                  demoId="unmissed_demo"
                  callerName="Visitor"
                  agentName="Zara"
                  companyName="unmissed.ai"
                  onEnd={close}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
