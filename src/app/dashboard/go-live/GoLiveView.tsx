'use client'

/**
 * GoLiveView — slimmed 2026-04-27.
 *
 * Original spec: docs/superpowers/specs/2026-04-26-go-live-tab-design.md (5 sections)
 *
 * Revised job (after first user review): "Get this number forwarded and
 * decide how you want to be alerted." Greeting, hours, and test-orb are
 * duplicated on Overview/Settings — Go Live is the operator's setup
 * checklist, not a second editor.
 *
 * Layout (mobile-first, single column):
 *   HERO          — Twilio number tap-to-copy (or trial CTA)
 *   FORWARDING    — <CallForwardingCard /> — carrier dial code + self-attest
 *   NOTIFICATIONS — <NotificationsBlock /> — Telegram advisory + inline-editable
 *                    SMS auto-text reply + inline-editable voicemail greeting
 *   BANNER        — <GoLiveBanner /> sticky pill when forwarding is attested
 *
 * Voice section removed 2026-04-27 — pending owner decision on whether to keep
 * a voice picker on Go Live. Settings → Voice card still owns voice editing.
 *
 * Live definition (derived, no `is_live` DB column):
 *   isLive = forwarding_self_attested || forwarding_verified_at is set.
 *   Honest: greeting/voice/test-call don't gate going live — only forwarding does.
 *
 * Dropped from previous iteration:
 *   - Section 1 (greeting fields) — lives on Settings → Agent
 *   - Section 2 (hours / after-hours / weekend) — agent is 24/7 message-taking
 *   - Section 5 (test orb) — already on Overview/Settings
 *   - Twilio verify-call flow — never tested end-to-end (deferred)
 *   - GO_LIVE_VOICES curated 6 — replaced by full catalog
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhone } from '@/lib/format-phone'
import type { CarrierKey } from '@/lib/carrier-codes'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

import CallForwardingCard from '@/components/dashboard/go-live/CallForwardingCard'
import GoLiveBanner from '@/components/dashboard/go-live/GoLiveBanner'
import NotificationsBlock from '@/components/dashboard/go-live/NotificationsBlock'
// Voice picker temporarily removed from Go Live (2026-04-27). Owner will decide
// later whether to bring it back as an inline picker. Keep import path stable —
// re-add `import GoLiveVoicePicker from '@/components/dashboard/go-live/GoLiveVoicePicker'`
// and the section below if reinstating.

interface Props {
  client: ClientConfig
  // hasTestCall is no longer part of the live definition but the page-level
  // server query still passes it through; ignored here, kept on the prop
  // contract so the page.tsx call site doesn't need to change.
  hasTestCall?: boolean
  isAdmin: boolean
}

const PATCH_DEBOUNCE_MS = 800

export default function GoLiveView({ client, isAdmin }: Props) {
  const router = useRouter()
  const { patch } = usePatchSettings(client.id, isAdmin, {
    onSave: () => router.refresh(),
  })

  // ── Carrier dropdown — local UI state (not a DB column) ─────────────────
  const carrierKey = `go-live:carrier:${client.id}`
  const [localCarrier, setLocalCarrier] = useState<CarrierKey>(() => {
    if (typeof window === 'undefined') return 'rogers'
    try {
      const stored = window.localStorage.getItem(carrierKey)
      if (stored && isValidCarrier(stored)) return stored
    } catch {/* localStorage may be unavailable in some webview contexts */}
    return 'rogers'
  })

  const onCarrierChange = useCallback(
    (next: CarrierKey) => {
      setLocalCarrier(next)
      try { window.localStorage.setItem(carrierKey, next) } catch {/* noop */}
    },
    [carrierKey],
  )

  // ── callback_phone debounced PATCH ──────────────────────────────────────
  const callbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onForwardingNumberChange = useCallback(
    (next: string) => {
      if (callbackTimerRef.current) clearTimeout(callbackTimerRef.current)
      callbackTimerRef.current = setTimeout(() => {
        void patch({ callback_phone: next })
      }, PATCH_DEBOUNCE_MS)
    },
    [patch],
  )
  useEffect(() => () => {
    if (callbackTimerRef.current) clearTimeout(callbackTimerRef.current)
  }, [])

  // ── Live derivation ─────────────────────────────────────────────────────
  const isLive = !!client.forwarding_verified_at || !!client.forwarding_self_attested

  // ── Hero ────────────────────────────────────────────────────────────────
  const twilioNumber = client.twilio_number
  const formattedTwilio = twilioNumber ? formatPhone(twilioNumber) : null
  const [heroCopied, setHeroCopied] = useState(false)
  const copyHero = useCallback(async () => {
    if (!twilioNumber) return
    try {
      await navigator.clipboard.writeText(twilioNumber)
      navigator.vibrate?.(10)
      setHeroCopied(true)
      setTimeout(() => setHeroCopied(false), 1500)
    } catch {/* clipboard may fail in insecure contexts — degrade silently */}
  }, [twilioNumber])

  // ── Notifications block inputs ──────────────────────────────────────────
  // hasSms gates the SMS auto-text editor — sending requires a Twilio number.
  // (Mirrors the Overview tile rule; see PostCallActionsTile.)
  const telegramConnected = !!client.telegram_chat_id
  const hasSms = !!client.twilio_number
  const notifications = useMemo(() => ({
    telegramConnected,
    hasSms,
    smsEnabled: !!client.sms_enabled,
    smsTemplate: client.sms_template,
    voicemailGreetingText: client.voicemail_greeting_text,
    agentName: client.agent_name,
    businessName: client.business_name,
  }), [
    telegramConnected,
    hasSms,
    client.sms_enabled,
    client.sms_template,
    client.voicemail_greeting_text,
    client.agent_name,
    client.business_name,
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[600px] px-4 py-10 lg:py-12 space-y-10 lg:space-y-12">
        {/* ═══════════ HERO — Your number ═══════════ */}
        <section aria-labelledby="go-live-hero-heading">
          <h1 id="go-live-hero-heading" className="sr-only">Your number</h1>

          {twilioNumber ? (
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Your number
              </p>
              <button
                type="button"
                onClick={copyHero}
                className="inline-flex flex-col items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-2xl px-4 py-2"
                aria-label={`Copy your number ${formattedTwilio}`}
              >
                <span className="text-3xl font-semibold text-zinc-900 tabular-nums">
                  {formattedTwilio}
                </span>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-700">
                  {heroCopied ? 'Copied ✓' : 'Tap to copy'}
                </span>
              </button>
              <p className="mt-4 text-base text-zinc-600 max-w-md mx-auto">
                Calls to this number reach your agent once forwarding is set up.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Your number
              </p>
              <p className="text-2xl font-semibold text-zinc-900">
                You&apos;ll get a number when you upgrade.
              </p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm font-medium text-zinc-900 transition-colors"
              >
                Upgrade plan
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </section>

        {/* ═══════════ Forwarding (the centerpiece) ═══════════ */}
        <section aria-labelledby="go-live-forwarding-heading">
          <SectionHeader id="go-live-forwarding-heading" title="Forward your phone" />
          <CallForwardingCard
            twilioNumber={client.twilio_number}
            forwardingNumber={client.callback_phone || ''}
            onForwardingNumberChange={onForwardingNumberChange}
            carrier={localCarrier}
            onCarrierChange={onCarrierChange}
            forwardingVerifiedAt={client.forwarding_verified_at}
            forwardingSelfAttested={!!client.forwarding_self_attested}
            onVerified={() => router.refresh()}
          />
        </section>

        {/* ═══════════ Notifications ═══════════ */}
        <section aria-labelledby="go-live-notifications-heading">
          <SectionHeader id="go-live-notifications-heading" title="How you'll be notified" />
          <NotificationsBlock
            clientId={client.id}
            isAdmin={isAdmin}
            telegramConnected={notifications.telegramConnected}
            hasSms={notifications.hasSms}
            smsEnabled={notifications.smsEnabled}
            smsTemplate={notifications.smsTemplate}
            voicemailGreetingText={notifications.voicemailGreetingText}
            agentName={notifications.agentName}
            businessName={notifications.businessName}
          />
        </section>

        {/* Voice section removed 2026-04-27 — owner deciding whether to keep. */}

        {/* Spacer so the sticky banner doesn't cover the last block. */}
        <div aria-hidden="true" className="h-24 lg:h-32" />
      </div>

      {/* Sticky banner — fires off forwarding self-attestation */}
      <GoLiveBanner isLive={isLive} twilioNumber={client.twilio_number} />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="text-2xl font-semibold text-zinc-900 mb-4 px-1">
      {title}
    </h2>
  )
}

const _CARRIER_KEYS = ['rogers', 'fido', 'bell', 'telus', 'koodo', 'virgin', 'freedom', 'other'] as const
function isValidCarrier(v: string): v is CarrierKey {
  return (_CARRIER_KEYS as readonly string[]).includes(v)
}
