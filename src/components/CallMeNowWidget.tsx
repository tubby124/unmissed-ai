"use client"

import { useState, useRef } from "react"
import { Phone, Check, AlertCircle, Loader2, ChevronDown } from "lucide-react"
import { CALL_ME_WIDGET_COPY } from "@/lib/marketing-content"
import { trackEvent } from "@/lib/analytics"

interface CallMeNowWidgetProps {
  /** Pre-selected niche for the demo agent (default: auto_glass) */
  niche?: string
  /** Compact mode for hero embedding (no border/bg, tighter spacing) */
  compact?: boolean
  /** Collect caller name before placing demo call */
  collectName?: boolean
  /** Collect optional email for follow-up */
  collectEmail?: boolean
  /** Collect optional shop/company name for prompt personalization */
  collectShopName?: boolean
  /** Collect optional missed-call pain point for prompt personalization */
  collectPain?: boolean
  /** Copy/layout treatment */
  variant?: "default" | "windshield"
  /** Called after a call is successfully initiated */
  onCallStarted?: (callSid: string) => void
  /** Called on error */
  onError?: (message: string) => void
}

type WidgetState = "idle" | "loading" | "success" | "error"

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function isValidNAPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "")
  return digits.length === 10
}

function isValidEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const painOptions = [
  { value: "busy-installs", label: "We miss calls during installs" },
  { value: "after-hours", label: "After-hours callers go to voicemail" },
  { value: "junk-filtering", label: "We want junk filtered out" },
  { value: "quote-triage", label: "We want better quote triage" },
]

export default function CallMeNowWidget({
  niche,
  compact = false,
  collectName = false,
  collectEmail = false,
  collectShopName = false,
  collectPain = false,
  variant = "default",
  onCallStarted,
  onError,
}: CallMeNowWidgetProps) {
  const [phone, setPhone] = useState("")
  const [callerName, setCallerName] = useState("")
  const [callerEmail, setCallerEmail] = useState("")
  const [shopName, setShopName] = useState("")
  const [painPoint, setPainPoint] = useState("")
  const [countryCode] = useState("+1")
  const [state, setState] = useState<WidgetState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const digits = phone.replace(/\D/g, "")
  const nameIsValid = !collectName || callerName.trim().length >= 2
  const emailIsValid = isValidEmail(callerEmail.trim())
  const isValid = isValidNAPhone(phone) && nameIsValid && emailIsValid
  const isWindshield = variant === "windshield"

  function clearError() {
    if (state === "error") {
      setState("idle")
      setErrorMsg("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || state === "loading") return

    setState("loading")
    setErrorMsg("")
    trackEvent("demo_hero_submit", {
      niche: niche ?? "unmissed_demo",
      variant,
      has_email: Boolean(callerEmail.trim()),
      has_shop: Boolean(shopName.trim()),
    })

    const e164 = `${countryCode}${digits}`

    try {
      const res = await fetch("/api/demo/call-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: e164,
          niche,
          callerName: callerName.trim() || undefined,
          callerEmail: callerEmail.trim() || undefined,
          shopName: shopName.trim() || undefined,
          painPoint: painPoint || undefined,
          demoVariant: variant,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.error || "Something went wrong. Try again."
        setState("error")
        setErrorMsg(msg)
        trackEvent("demo_call_missed", { niche: niche ?? "unmissed_demo", variant })
        onError?.(msg)
        return
      }

      setState("success")
      trackEvent("demo_call_completed", { niche: niche ?? "unmissed_demo", variant, call_sid: data.callSid ?? "" })
      onCallStarted?.(data.callSid)

      // Reset after 20s — outbound Twilio calls can take 15-20s to connect
      setTimeout(() => {
        setState("idle")
        setPhone("")
        setCallerName("")
        setCallerEmail("")
        setShopName("")
        setPainPoint("")
      }, 20000)
    } catch {
      const msg = "Network error. Check your connection and try again."
      setState("error")
      setErrorMsg(msg)
      onError?.(msg)
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10)
    setPhone(raw)
    clearError()
  }

  if (state === "success") {
    return (
      <div
        className={`flex flex-col items-center gap-3 ${compact ? "py-3" : "p-6 rounded-2xl"}`}
        style={
          compact
            ? {}
            : {
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }
        }
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
        >
          <Check size={24} style={{ color: "#10B981" }} />
        </div>
        <p className="text-sm font-semibold text-center" style={{ color: "var(--color-text-1)" }}>
          {isWindshield ? "Got it — the demo agent is calling now." : CALL_ME_WIDGET_COPY.successHeading}
        </p>
        <p className="text-xs text-center" style={{ color: "var(--color-text-3)" }}>
          {isWindshield
            ? "Answer the call and you’ll hear the same auto-glass triage flow your shop would use."
            : CALL_ME_WIDGET_COPY.successBody}
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "" : "p-5 rounded-2xl"}
      style={
        compact
          ? {}
          : {
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }
      }
    >
      {!compact && (
        <p
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--color-text-1)" }}
        >
          {isWindshield ? "Have the auto-glass AI call you" : CALL_ME_WIDGET_COPY.standardLabel}
        </p>
      )}

      {(collectName || collectEmail || collectShopName || collectPain) && (
        <div className="grid gap-2 mb-3">
          {collectName && (
            <input
              type="text"
              value={callerName}
              onChange={(e) => { setCallerName(e.target.value.slice(0, 80)); clearError() }}
              placeholder="Your name"
              autoComplete="name"
              disabled={state === "loading"}
              className="px-4 py-3 rounded-lg text-sm outline-none min-w-0"
              style={{
                backgroundColor: "var(--color-bg)",
                border: `1px solid ${state === "error" && !nameIsValid ? "#EF4444" : "var(--color-border)"}`,
                color: "var(--color-text-1)",
              }}
            />
          )}
          {collectShopName && (
            <input
              type="text"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value.slice(0, 120)); clearError() }}
              placeholder="Shop name (optional)"
              autoComplete="organization"
              disabled={state === "loading"}
              className="px-4 py-3 rounded-lg text-sm outline-none min-w-0"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-1)",
              }}
            />
          )}
          {collectEmail && (
            <input
              type="email"
              value={callerEmail}
              onChange={(e) => { setCallerEmail(e.target.value.slice(0, 160)); clearError() }}
              placeholder="Email for the demo summary (optional)"
              autoComplete="email"
              disabled={state === "loading"}
              className="px-4 py-3 rounded-lg text-sm outline-none min-w-0"
              style={{
                backgroundColor: "var(--color-bg)",
                border: `1px solid ${state === "error" && !emailIsValid ? "#EF4444" : "var(--color-border)"}`,
                color: "var(--color-text-1)",
              }}
            />
          )}
          {collectPain && (
            <select
              value={painPoint}
              onChange={(e) => { setPainPoint(e.target.value); clearError() }}
              disabled={state === "loading"}
              className="px-4 py-3 rounded-lg text-sm outline-none min-w-0"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: painPoint ? "var(--color-text-1)" : "var(--color-text-3)",
              }}
            >
              <option value="">What should the demo focus on? (optional)</option>
              {painOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 gap-2">
          {/* Country code (static for now — NA only) */}
          <div
            className="flex items-center gap-1 px-3 rounded-lg text-sm shrink-0"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-2)",
            }}
          >
            <span className="text-xs">+1</span>
            <ChevronDown size={12} style={{ color: "var(--color-text-3)" }} />
          </div>

          {/* Phone input */}
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            value={formatPhoneDisplay(phone)}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            autoComplete="tel-national"
            disabled={state === "loading"}
            className="min-w-0 flex-1 px-4 py-3 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--color-bg)",
              border: `1px solid ${state === "error" && !isValidNAPhone(phone) ? "#EF4444" : "var(--color-border)"}`,
              color: "var(--color-text-1)",
            }}
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || state === "loading"}
          className="flex w-full items-center justify-center gap-2 px-5 py-3 rounded-lg text-white font-semibold text-sm shrink-0 transition-all sm:w-auto"
          style={{
            backgroundColor:
              !isValid || state === "loading"
                ? "var(--color-text-3)"
                : isWindshield
                  ? "var(--color-primary)"
                  : "var(--color-cta)",
            cursor: !isValid || state === "loading" ? "not-allowed" : "pointer",
            opacity: !isValid || state === "loading" ? 0.6 : 1,
          }}
        >
          {state === "loading" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Phone size={16} />
          )}
          <span>
            {state === "loading" ? CALL_ME_WIDGET_COPY.buttonLoading : isWindshield ? "Call me" : CALL_ME_WIDGET_COPY.buttonIdle}
          </span>
        </button>
      </div>

      {/* Error message */}
      {state === "error" && errorMsg && (
        <div className="flex items-center gap-2 mt-2">
          <AlertCircle size={14} style={{ color: "#EF4444" }} />
          <p className="text-xs" style={{ color: "#EF4444" }}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* Helper text */}
      <p
        className="text-xs mt-2"
        style={{ color: "var(--color-text-3)" }}
      >
        {isWindshield
          ? "The AI calls your phone, greets you by name, then walks through a real windshield-call demo."
          : compact ? CALL_ME_WIDGET_COPY.helperTextCompact : CALL_ME_WIDGET_COPY.helperTextFull}
      </p>

      {/* Proof line — compact/hero mode only */}
      {compact && (
        <p
          className="text-xs mt-1 opacity-70"
          style={{ color: "var(--color-text-3)" }}
        >
          {isWindshield ? "Name + phone only. We use it to place this demo call." : CALL_ME_WIDGET_COPY.proofLine}
        </p>
      )}
    </form>
  )
}
