"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import DemoCall from "./DemoCall"
import { loadVisitor, saveVisitor, normalizePhoneNA, type VisitorInfo } from "@/lib/demo-visitor"
import { TALK_TO_ZARA_COPY } from "@/lib/marketing-content"
import { trackEvent } from "@/lib/analytics"

type WidgetStep = "closed" | "form" | "call"

const EXCLUDED_PREFIXES = ["/dashboard", "/onboard", "/admin", "/api", "/login"]

export default function TalkToAgentWidget() {
  const pathname = usePathname()
  const [step, setStep] = useState<WidgetStep>("closed")
  const [showPulse, setShowPulse] = useState(true)
  const [nameInput, setNameInput] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(null)

  // Load saved visitor info on mount
  useEffect(() => {
    const saved = loadVisitor()
    if (saved) {
      setNameInput(saved.name)
      setEmailInput(saved.email)
      setPhoneInput(saved.phone)
      setVisitorInfo(saved)
    }
  }, [])

  // Stop pulse after 8s
  useEffect(() => {
    const t = setTimeout(() => setShowPulse(false), 8000)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => setStep("closed"), [])

  // Escape key to close
  useEffect(() => {
    if (step === "closed") return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [step, close])

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (step !== "closed") {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [step])

  if (EXCLUDED_PREFIXES.some(p => pathname.startsWith(p))) return null

  function open() {
    setShowPulse(false)
    trackEvent("demo_widget_open")
    // Skip form if we already have visitor info saved
    if (visitorInfo) {
      setStep("call")
    } else {
      setStep("form")
    }
  }

  function submitForm() {
    const rawPhone = phoneInput.trim()
    const info = {
      name: nameInput.trim(),
      email: emailInput.trim(),
      phone: rawPhone,
    }
    saveVisitor(info)
    setVisitorInfo({ ...info, phone: normalizePhoneNA(rawPhone) || rawPhone })
    trackEvent("demo_browser_start", { has_phone: !!rawPhone })
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

            <span className="relative hidden sm:inline whitespace-nowrap leading-tight text-left">
              {TALK_TO_ZARA_COPY.floatingLabel}
              <span className="block text-[9px] opacity-55 font-normal tracking-wide">
                {TALK_TO_ZARA_COPY.floatingSubline}
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Full-screen overlay (form or call) ── */}
      <AnimatePresence>
        {step !== "closed" && (
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

              {/* Quick info form — shown for first-time visitors */}
              {step === "form" && (
                <div className="px-4 pb-5 sm:px-5 pt-4">
                  <p className="text-sm mb-4" style={{ color: "var(--color-text-2)" }}>
                    {TALK_TO_ZARA_COPY.formIntro}
                  </p>
                  <form onSubmit={e => { e.preventDefault(); submitForm() }}>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm mb-2.5 outline-none focus:ring-2"
                      style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                      autoFocus
                    />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="Email (optional)"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm mb-2.5 outline-none focus:ring-2"
                      style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder={TALK_TO_ZARA_COPY.phonePlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm mb-3.5 outline-none focus:ring-2"
                      style={{ color: "var(--color-text-1)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm cursor-pointer transition-colors"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      {TALK_TO_ZARA_COPY.submitLabel}
                    </button>
                  </form>
                  <button
                    onClick={() => { submitForm() }}
                    className="w-full text-xs mt-2 py-1 cursor-pointer"
                    style={{ color: "var(--color-text-3)" }}
                  >
                    {TALK_TO_ZARA_COPY.skipLabel}
                  </button>
                </div>
              )}

              {/* DemoCall — auto-starts on mount */}
              {step === "call" && (
                <div className="px-3 pb-5 sm:px-4 pt-2">
                  <DemoCall
                    demoId="unmissed_demo"
                    callerName={visitorInfo?.name || "Visitor"}
                    agentName="Zara"
                    companyName="unmissed.ai"
                    extraBody={{
                      ...(visitorInfo?.phone ? { callerPhone: visitorInfo.phone } : {}),
                      ...(visitorInfo?.email ? { callerEmail: visitorInfo.email } : {}),
                    }}
                    onEnd={close}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
