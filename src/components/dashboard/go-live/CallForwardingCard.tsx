'use client'

/**
 * CallForwardingCard — Go Live "Forward your phone" section.
 *
 * Spec revised 2026-04-27:
 *   - Drop the Twilio verify-call flow from the UI. The verify endpoint
 *     was never tested end-to-end against a live carrier-forwarded call.
 *   - Lead with: pick carrier → show dial code → "Now call your own number
 *     to test" → user clicks "It worked — I heard the agent" → self-attest.
 *
 * The self-attest endpoint stamps both `forwarding_self_attested=true` and
 * `forwarding_verified_at=now()` on the clients row. The Go Live banner
 * fires off `forwarding_self_attested`.
 *
 * The verify TwiML + confirm endpoint stay on disk as deferred infra and
 * may be re-surfaced later (see CALLINGAGENTS/Tracker/forwarding-verify-twilio.md).
 *
 * Trial branch: when `twilioNumber` is null, render the unlock notice only.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CARRIER_CODES, type CarrierKey } from '@/lib/carrier-codes'
import { normalizePhoneNA } from '@/lib/utils/phone'
import { formatPhone } from '@/lib/format-phone'

interface CallForwardingCardProps {
  twilioNumber: string | null
  forwardingNumber: string
  onForwardingNumberChange: (next: string) => void
  carrier: CarrierKey
  onCarrierChange: (next: CarrierKey) => void
  forwardingVerifiedAt: string | null
  forwardingSelfAttested: boolean
  onVerified: () => void
}

type AttestState = 'idle' | 'submitting' | 'failed'

export default function CallForwardingCard({
  twilioNumber,
  forwardingNumber,
  onForwardingNumberChange,
  carrier,
  onCarrierChange,
  forwardingVerifiedAt,
  forwardingSelfAttested,
  onVerified,
}: CallForwardingCardProps) {
  const verified = !!forwardingVerifiedAt || forwardingSelfAttested
  // Hooks must run unconditionally — trial early-return comes AFTER all hooks.
  const [expanded, setExpanded] = useState<boolean>(!verified)

  useEffect(() => {
    setExpanded(!verified)
  }, [verified])

  if (!twilioNumber) {
    return (
      <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">Forward your phone</h2>
        <p className="text-sm text-zinc-600">
          This unlocks when you upgrade — your number gets activated automatically.
        </p>
      </div>
    )
  }

  const showCollapsedPill = verified && !expanded

  return (
    <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Forward your phone</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Set up call forwarding so callers reach your agent on this number.
      </p>

      {showCollapsedPill ? (
        <CollapsedPill
          twilioNumber={twilioNumber}
          carrier={carrier}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <SetupForm
          twilioNumber={twilioNumber}
          forwardingNumber={forwardingNumber}
          onForwardingNumberChange={onForwardingNumberChange}
          carrier={carrier}
          onCarrierChange={onCarrierChange}
          forwardingVerifiedAt={forwardingVerifiedAt}
          forwardingSelfAttested={forwardingSelfAttested}
          onVerified={onVerified}
        />
      )}
    </div>
  )
}

// ─── Collapsed-when-attested pill ─────────────────────────────────────────────

function CollapsedPill({
  twilioNumber,
  carrier,
  onExpand,
}: {
  twilioNumber: string
  carrier: CarrierKey
  onExpand: () => void
}) {
  const carrierName = CARRIER_CODES[carrier]?.name ?? 'Other'
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-left hover:bg-emerald-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      aria-label="Forwarding set up — tap to edit or re-test"
    >
      <span className="text-sm font-medium text-emerald-900">
        ✓ Forwarding set up — {carrierName} · {formatPhone(twilioNumber)}
      </span>
      <span className="text-xs text-emerald-700">Edit</span>
    </button>
  )
}

// ─── Full setup form ─────────────────────────────────────────────────────────

function SetupForm({
  twilioNumber,
  forwardingNumber,
  onForwardingNumberChange,
  carrier,
  onCarrierChange,
  forwardingVerifiedAt,
  forwardingSelfAttested,
  onVerified,
}: {
  twilioNumber: string
  forwardingNumber: string
  onForwardingNumberChange: (next: string) => void
  carrier: CarrierKey
  onCarrierChange: (next: CarrierKey) => void
  forwardingVerifiedAt: string | null
  forwardingSelfAttested: boolean
  onVerified: () => void
}) {
  const [attest, setAttest] = useState<AttestState>('idle')
  const [copied, setCopied] = useState(false)
  const inFlight = useRef(false)

  const carrierEntry = CARRIER_CODES[carrier]
  const enableCode = carrierEntry?.enable
    ? carrierEntry.enable.replace('{number}', stripPlus(twilioNumber))
    : null
  const disableCode = carrierEntry?.disable ?? null
  const isOtherCarrier = carrier === 'other'

  // Status pill — gray "Not set up yet" | green "Forwarded ✓ {when}" | amber on submit error
  let statusPill: { tone: 'gray' | 'green' | 'amber'; text: string }
  if (attest === 'failed') {
    statusPill = { tone: 'amber', text: "Couldn't save — try again" }
  } else if (forwardingVerifiedAt || forwardingSelfAttested) {
    const when = forwardingVerifiedAt ? formatRelative(forwardingVerifiedAt) : 'just now'
    statusPill = { tone: 'green', text: `Forwarded ✓ ${when}` }
  } else {
    statusPill = { tone: 'gray', text: 'Not set up yet' }
  }

  async function copyEnableCode() {
    if (!enableCode) return
    try {
      await navigator.clipboard.writeText(enableCode)
      navigator.vibrate?.(10)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can fail in insecure contexts — degrade silently.
    }
  }

  async function markItWorks() {
    if (inFlight.current) return
    inFlight.current = true
    setAttest('submitting')
    try {
      const res = await fetch('/api/dashboard/forwarding-verify/self-attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setAttest('idle')
        onVerified()
      } else {
        setAttest('failed')
      }
    } catch {
      setAttest('failed')
    } finally {
      inFlight.current = false
    }
  }

  const isBusy = attest === 'submitting'

  return (
    <div className="space-y-5">
      {/* Carrier picker is the centerpiece */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-900">
          Pick your carrier
        </label>
        <select
          value={carrier}
          onChange={(e) => onCarrierChange(e.target.value as CarrierKey)}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          {(Object.keys(CARRIER_CODES) as CarrierKey[]).map((key) => (
            <option key={key} value={key}>
              {CARRIER_CODES[key].name}
            </option>
          ))}
        </select>
      </div>

      {/* Dial code (or fallback for "other") */}
      {isOtherCarrier ? (
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-5 py-4 text-sm text-zinc-700 leading-relaxed">
          Most Canadian carriers use{' '}
          <code className="font-mono text-zinc-900">*72&lt;your number&gt;</code> to forward and{' '}
          <code className="font-mono text-zinc-900">*73</code> to turn off. If that doesn&apos;t work,
          search &ldquo;[your carrier] call forwarding&rdquo; or contact us.
        </div>
      ) : (
        enableCode && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-900">Dial this on your phone:</p>
            <button
              type="button"
              onClick={copyEnableCode}
              className="w-full min-h-[120px] rounded-2xl bg-zinc-50 border border-zinc-200 px-5 py-6 text-center hover:bg-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
              aria-label={`Tap to copy dial code ${enableCode}`}
            >
              <span className="block text-3xl sm:text-4xl font-mono tracking-wider text-zinc-900 break-all">
                {enableCode}
              </span>
              <span className="mt-3 inline-block text-xs text-zinc-500">
                {copied ? 'Copied ✓' : 'Tap to copy'}
              </span>
            </button>
            {disableCode && (
              <p className="text-sm text-zinc-600 pt-2">
                To turn it off later:{' '}
                <code className="text-base font-mono text-zinc-900">{disableCode}</code>
              </p>
            )}
          </div>
        )
      )}

      {/* Optional: where calls get forwarded TO (callback_phone) */}
      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer text-zinc-700 hover:text-zinc-900 select-none">
          Your callback number (optional)
        </summary>
        <label className="block mt-2">
          <span className="sr-only">Your business cell or office line</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={forwardingNumber}
            onChange={(e) => onForwardingNumberChange(e.target.value)}
            onBlur={(e) => {
              const normalized = normalizePhoneNA(e.target.value)
              if (normalized && normalized !== forwardingNumber) {
                onForwardingNumberChange(normalized)
              }
            }}
            placeholder="Your business cell or office line"
            className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <span className="block text-xs text-zinc-500 mt-1">
            We&apos;ll suggest this number when leaving a callback message for you.
          </span>
        </label>
      </details>

      {/* Test instructions + self-attest CTA */}
      <div className="rounded-2xl bg-zinc-900 text-white p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 inline-flex w-6 h-6 rounded-full bg-white/15 items-center justify-center text-xs font-semibold">
            !
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Now test it yourself</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Call your own number ({formatPhone(twilioNumber)}) from another phone.
              You should hear your agent answer. If you do, tap below.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={markItWorks}
          disabled={isBusy}
          className="w-full rounded-xl bg-white text-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isBusy ? (
              <motion.span
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Saving…
              </motion.span>
            ) : attest === 'failed' ? (
              <motion.span
                key="bad"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Try again
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                It worked — I heard the agent
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <StatusPill tone={statusPill.tone} text={statusPill.text} />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusPill({ tone, text }: { tone: 'gray' | 'green' | 'amber'; text: string }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-zinc-50 text-zinc-700 border-zinc-200'
  return (
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${cls}`}
      role="status"
    >
      {text}
    </div>
  )
}

function stripPlus(num: string): string {
  return num.startsWith('+') ? num.slice(1) : num
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'recently'
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMo = Math.round(diffDay / 30)
  if (diffMo < 12) return `${diffMo}mo ago`
  const diffYr = Math.round(diffMo / 12)
  return `${diffYr}y ago`
}
