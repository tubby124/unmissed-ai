"use client"

import { useState, useRef } from "react"
import { Phone, Check, AlertCircle, Loader2, ChevronDown } from "lucide-react"

interface CallMeNowWidgetProps {
  /** Pre-selected niche for the demo agent (default: auto_glass) */
  niche?: string
  /** Compact mode for hero embedding (no border/bg, tighter spacing) */
  compact?: boolean
  /** Called after a call is successfully initiated */
  onCallStarted?: (callSid: string) => void
  /** Called on error */
  onError?: (message: string) => void
}

type WidgetState = "idle" | "loading" | "success" | "error"

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA", flag: "🇺🇸" },
]

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

export default function CallMeNowWidget({
  niche,
  compact = false,
  onCallStarted,
  onError,
}: CallMeNowWidgetProps) {
  const [phone, setPhone] = useState("")
  const [countryCode] = useState("+1")
  const [state, setState] = useState<WidgetState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const digits = phone.replace(/\D/g, "")
  const isValid = isValidNAPhone(phone)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || state === "loading") return

    setState("loading")
    setErrorMsg("")

    const e164 = `${countryCode}${digits}`

    try {
      const res = await fetch("/api/demo/call-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, niche }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.error || "Something went wrong. Try again."
        setState("error")
        setErrorMsg(msg)
        onError?.(msg)
        return
      }

      setState("success")
      onCallStarted?.(data.callSid)

      // Reset after 8 seconds
      setTimeout(() => {
        setState("idle")
        setPhone("")
      }, 8000)
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
    if (state === "error") {
      setState("idle")
      setErrorMsg("")
    }
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
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-1)" }}>
          Calling you now!
        </p>
        <p className="text-xs text-center" style={{ color: "var(--color-text-3)" }}>
          Pick up when your phone rings. You&apos;ll be connected to an AI agent demo.
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
          Get a call from our AI agent
        </p>
      )}

      <div className="flex gap-2">
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
          className="flex-1 px-4 py-3 rounded-lg text-sm outline-none min-w-0"
          style={{
            backgroundColor: "var(--color-bg)",
            border: `1px solid ${state === "error" ? "#EF4444" : "var(--color-border)"}`,
            color: "var(--color-text-1)",
          }}
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || state === "loading"}
          className="flex items-center gap-2 px-5 py-3 rounded-lg text-white font-semibold text-sm shrink-0 transition-all"
          style={{
            backgroundColor:
              !isValid || state === "loading"
                ? "var(--color-text-3)"
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
          <span className="hidden sm:inline">
            {state === "loading" ? "Calling..." : "Call Me"}
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
        {compact
          ? "Enter your number. We'll call you in seconds."
          : "We'll call your phone and connect you to a live AI agent demo. No app needed."}
      </p>
    </form>
  )
}
