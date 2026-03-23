"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { X, Mic } from "lucide-react"
import DemoCall from "./DemoCall"

type WidgetStep = "closed" | "call"

// Pages where the widget should NOT appear
const EXCLUDED_PREFIXES = ["/dashboard", "/onboard", "/admin", "/api", "/login"]

export default function TalkToAgentWidget() {
  const pathname = usePathname()
  const [step, setStep] = useState<WidgetStep>("closed")
  const [showPulse, setShowPulse] = useState(true)

  // Stop pulse after 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowPulse(false), 8000)
    return () => clearTimeout(t)
  }, [])

  // Hide on dashboard/admin/onboard pages
  if (EXCLUDED_PREFIXES.some(p => pathname.startsWith(p))) return null

  function open() {
    setShowPulse(false)
    setStep("call")
  }

  function close() {
    setStep("closed")
  }

  return (
    <>
      {/* ── Floating button ── */}
      {step === "closed" && (
        <button
          onClick={open}
          aria-label="Talk to Zara, our AI agent"
          className="fixed bottom-20 left-5 md:bottom-5 z-50 flex items-center gap-2 rounded-full shadow-lg text-white text-sm font-semibold transition-transform active:scale-95 hover:scale-105"
          style={{
            backgroundColor: "var(--color-primary)",
            padding: "14px 18px",
            boxShadow: "0 4px 24px rgba(79,70,229,0.45)",
          }}
        >
          {/* Pulse ring — attention grabber on first load */}
          {showPulse && (
            <span
              className="absolute inset-0 rounded-full animate-ping pointer-events-none"
              style={{ backgroundColor: "var(--color-primary)", opacity: 0.25 }}
            />
          )}
          <Mic size={18} className="relative shrink-0" />
          <span className="relative hidden sm:inline whitespace-nowrap">Talk to Zara</span>
        </button>
      )}

      {/* ── Full-screen call overlay ── */}
      {step === "call" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          {/* Mobile: full-width bottom sheet | Desktop: centered card */}
          <div
            className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[95vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Drag handle on mobile */}
            <div className="sm:hidden flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--color-border)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-5 sm:pt-4">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-3)" }}>
                Live Demo — unmissed.ai
              </p>
              <button
                onClick={close}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: "var(--color-text-3)" }}
                aria-label="Close demo"
              >
                <X size={16} />
              </button>
            </div>

            {/* DemoCall orb — auto-starts on mount */}
            <div className="px-3 pb-5 sm:px-4">
              <DemoCall
                demoId="unmissed_demo"
                callerName="Visitor"
                agentName="Zara"
                companyName="unmissed.ai"
                onEnd={close}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
