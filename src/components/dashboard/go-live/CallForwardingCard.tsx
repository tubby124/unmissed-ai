'use client'

/**
 * CallForwardingCard — Go Live "Forward your phone" section.
 *
 * Spec revised 2026-06-05:
 *   - Switched from a single unconditional code (star-21 / star-72 family) to
 *     THREE conditional codes per Canadian wireless GSM spec: no-answer (61),
 *     busy (67), unreachable (62). Conditional forwarding = phone rings the
 *     user first, forwards to AI only when they cannot pick up. Unconditional
 *     was wrong for a voicemail-replacement product.
 *   - Codes now live in lib/carrier-codes.ts under conditions.noAnswer / busy / unreachable.
 *   - Voicemail-blocking warning tightened — Rogers explicitly states
 *     conditional forwarding will not work while carrier voicemail is active.
 *
 * Prior spec (2026-04-27): drop the Twilio verify-call flow from the UI; lead
 * with carrier pick → dial codes → "I heard the agent" self-attest. That UX
 * is preserved.
 *
 * Trial branch: when `twilioNumber` is null, render the unlock notice only.
 */

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CARRIER_CODES, fillEnableCode, type CarrierKey } from '@/lib/carrier-codes'
import { formatPhone } from '@/lib/format-phone'

interface CallForwardingCardProps {
  twilioNumber: string | null
  carrier: CarrierKey
  onCarrierChange: (next: CarrierKey) => void
  forwardingVerifiedAt: string | null
  forwardingSelfAttested: boolean
  onVerified: () => void
  /** Phase 3 Wave B: when admin scoped into another client, the self-attest POST
   *  must include this so the row stamped is the scoped client, not the admin's
   *  own. Pass `null` for non-admin / self-scope and the helper will omit it. */
  scopedClientId?: string | null
  isAdmin?: boolean
}

type AttestState = 'idle' | 'submitting' | 'failed'

export default function CallForwardingCard({
  twilioNumber,
  carrier,
  onCarrierChange,
  forwardingVerifiedAt,
  forwardingSelfAttested,
  onVerified,
  scopedClientId,
  isAdmin,
}: CallForwardingCardProps) {
  const verified = !!forwardingVerifiedAt || forwardingSelfAttested
  const [forceExpanded, setForceExpanded] = useState(false)
  const expanded = !verified || forceExpanded

  if (!twilioNumber) {
    return (
      <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">Forward your phone</h2>
        <p className="text-sm text-zinc-600">
          Your AI number is still being assigned. Once it appears, you&apos;ll use this page to forward missed calls and run a real test.
        </p>
      </div>
    )
  }

  const showCollapsedPill = verified && !expanded

  return (
    <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
      {showCollapsedPill ? (
        <CollapsedPill
          twilioNumber={twilioNumber}
          carrier={carrier}
          onExpand={() => setForceExpanded(true)}
        />
      ) : (
        <SetupForm
          twilioNumber={twilioNumber}
          carrier={carrier}
          onCarrierChange={onCarrierChange}
          forwardingVerifiedAt={forwardingVerifiedAt}
          forwardingSelfAttested={forwardingSelfAttested}
          onVerified={onVerified}
          scopedClientId={scopedClientId}
          isAdmin={isAdmin}
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
      aria-label="Forwarding marked done — tap to edit or re-test"
    >
      <span className="text-sm font-medium text-emerald-900">
        ✓ Forwarding marked done — {carrierName} · {formatPhone(twilioNumber)}
      </span>
      <span className="text-xs text-emerald-700">Edit</span>
    </button>
  )
}

// ─── Full setup form ─────────────────────────────────────────────────────────

function SetupForm({
  twilioNumber,
  carrier,
  onCarrierChange,
  forwardingVerifiedAt,
  forwardingSelfAttested,
  onVerified,
  scopedClientId,
  isAdmin,
}: {
  twilioNumber: string
  carrier: CarrierKey
  onCarrierChange: (next: CarrierKey) => void
  forwardingVerifiedAt: string | null
  forwardingSelfAttested: boolean
  onVerified: () => void
  scopedClientId?: string | null
  isAdmin?: boolean
}) {
  const [attest, setAttest] = useState<AttestState>('idle')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const inFlight = useRef(false)

  const carrierEntry = CARRIER_CODES[carrier] ?? CARRIER_CODES.other
  const conditions = carrierEntry.conditions
  const carrierNote = carrierEntry.note

  const codes = [
    { key: 'noAnswer',    cond: conditions.noAnswer },
    { key: 'busy',        cond: conditions.busy },
    { key: 'unreachable', cond: conditions.unreachable },
  ] as const

  let statusPill: { tone: 'gray' | 'green' | 'amber'; text: string }
  if (attest === 'failed') {
    statusPill = { tone: 'amber', text: "Couldn't save — try again" }
  } else if (forwardingVerifiedAt || forwardingSelfAttested) {
    const when = forwardingVerifiedAt ? formatRelative(forwardingVerifiedAt) : 'just now'
    statusPill = { tone: 'green', text: `Marked done ✓ ${when}` }
  } else {
    statusPill = { tone: 'gray', text: 'Not set up yet' }
  }

  async function copyCode(key: string, code: string) {
    try {
      await navigator.clipboard.writeText(code)
      navigator.vibrate?.(10)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500)
    } catch {
      // Clipboard can fail in insecure contexts — degrade silently.
    }
  }

  async function markItWorks() {
    if (inFlight.current) return
    inFlight.current = true
    setAttest('submitting')
    try {
      const body: Record<string, unknown> = {}
      if (isAdmin && scopedClientId) body.client_id = scopedClientId
      const res = await fetch('/api/dashboard/forwarding-verify/self-attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      {carrierNote && (
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-5 py-4 text-sm text-zinc-700 leading-relaxed">
          {carrierNote}
        </div>
      )}

      {/* Three conditional dial codes — dial each one once, in any order */}
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-zinc-900">Dial these three codes on your phone — one at a time</p>
          <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
            Each code covers one situation. Together they forward to your AI only when you can&apos;t pick up. Your phone still rings first.
          </p>
        </div>
        <div className="space-y-2">
          {codes.map(({ key, cond }, idx) => {
            const enableCode = fillEnableCode(cond.enable, twilioNumber)
            const isCopied = copiedKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => copyCode(key, enableCode)}
                className="w-full rounded-2xl bg-zinc-50 border border-zinc-200 px-5 py-4 text-left hover:bg-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
                aria-label={`Tap to copy dial code ${enableCode} for ${cond.label}`}
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 inline-flex w-6 h-6 rounded-full bg-zinc-200 text-zinc-700 items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900">{cond.label}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{cond.desc}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 break-all">
                    {enableCode}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {isCopied ? 'Copied ✓' : 'Tap to copy'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Three-step instructions + self-attest CTA */}
      <div className="space-y-4">
        <ol className="space-y-2 text-sm text-zinc-700">
          <li className="flex gap-3">
            <span className="shrink-0 inline-flex w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 items-center justify-center text-xs font-semibold">1</span>
            <span className="pt-0.5">Open your phone keypad.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 inline-flex w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 items-center justify-center text-xs font-semibold">2</span>
            <span className="pt-0.5">Paste each of the 3 codes above and tap call. You&apos;ll get a short confirmation each time.</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 inline-flex w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 items-center justify-center text-xs font-semibold">3</span>
            <span className="pt-0.5">
              Call your regular business number from another phone, let it ring unanswered, and confirm the AI agent picks up.
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={markItWorks}
          disabled={isBusy}
          className="w-full rounded-2xl bg-zinc-900 text-white px-5 py-4 text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isBusy ? (
              <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Saving…
              </motion.span>
            ) : attest === 'failed' ? (
              <motion.span key="bad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Try again
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                It worked — my business number reached the agent
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <details className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-amber-900 select-none list-none flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Test went to voicemail instead?
          </summary>
          <div className="mt-2 text-[11px] text-amber-900/85 leading-relaxed space-y-2">
            <p>
              Your carrier voicemail is grabbing the call before the forward fires. Conditional forwarding will not work while carrier voicemail is active — you need to <strong>fully remove voicemail</strong> from this line at the carrier level. Toggling Visual Voicemail off in iOS settings is not enough.
            </p>
            <p>
              <strong>Call your carrier and say:</strong> <em>&ldquo;Please fully remove voicemail from my line. I&apos;m using a third-party answering service and it&apos;s blocking my call forwarding.&rdquo;</em> Takes 5 min, free on postpaid. Once they confirm removal, your forwards start firing automatically — no need to re-dial the codes.
            </p>
            <p className="font-mono text-[10px] text-amber-900/70">
              Rogers 1-800-764-3771 · Bell 1-800-668-6878 · Telus 1-866-558-2273 · Fido 1-888-481-3436 · SaskTel 1-800-727-5835
            </p>
          </div>
        </details>

        <details className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-900 select-none list-none">
            Turn forwarding off later
          </summary>
          <div className="mt-2 text-[11px] text-zinc-700 leading-relaxed space-y-2">
            <p>Dial each disable code on your phone keypad and tap call:</p>
            <ul className="space-y-1 font-mono text-[11px]">
              <li><span className="text-zinc-900 font-semibold">{conditions.noAnswer.disable}</span> — stop no-answer forwarding</li>
              <li><span className="text-zinc-900 font-semibold">{conditions.busy.disable}</span> — stop busy forwarding</li>
              <li><span className="text-zinc-900 font-semibold">{conditions.unreachable.disable}</span> — stop unreachable forwarding</li>
              <li><span className="text-zinc-900 font-semibold">##002#</span> — stop ALL forwarding at once (universal)</li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-900 select-none list-none">
            Test rang forever or code failed?
          </summary>
          <div className="mt-2 text-[11px] text-zinc-700 leading-relaxed space-y-2">
            <p><strong>Rang forever:</strong> the no-answer forward isn&apos;t active yet. Re-dial code 1 (the *61 one), wait for the carrier confirmation tone, then test again.</p>
            <p><strong>Code failed:</strong> your plan may need call forwarding enabled by carrier support. Ask them to enable conditional call forwarding (no-answer, busy, and unreachable) to {formatPhone(twilioNumber)}.</p>
            <p><strong>Agent answers only when calling the AI number directly:</strong> the agent is fine; the forwarding chain is the part still blocked.</p>
          </div>
        </details>

        <StatusPill tone={statusPill.tone} text={statusPill.text} />
      </div>
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
