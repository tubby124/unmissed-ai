'use client'

/**
 * GoLiveView — slimmed 2026-04-28.
 *
 * Three blocks. Single font (Geist Sans). Anything dumber would be a screensaver.
 *
 *   HERO        — Twilio number, tap to copy
 *   FORWARDING  — <CallForwardingCard /> — carrier dial code + self-attest
 *   TELEGRAM    — one-line connected indicator + Manage link to Settings
 *   BANNER      — <GoLiveBanner /> sticky pill when forwarding is attested
 *
 * Live definition (derived, no `is_live` DB column):
 *   isLive = forwarding_self_attested || forwarding_verified_at is set.
 *   Forwarding is the only thing that gates going live.
 *
 * SMS auto-text + voicemail greeting + voice picker live on Settings only —
 * not duplicated here.
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhone } from '@/lib/format-phone'
import type { CarrierKey } from '@/lib/carrier-codes'
import type { ClientConfig } from '@/app/dashboard/settings/page'

import CallForwardingCard from '@/components/dashboard/go-live/CallForwardingCard'
import GoLiveBanner from '@/components/dashboard/go-live/GoLiveBanner'

interface Props {
  client: ClientConfig
  // hasTestCall is no longer part of the live definition but the page-level
  // server query still passes it through; ignored here, kept on the prop
  // contract so the page.tsx call site doesn't need to change.
  hasTestCall?: boolean
  isAdmin: boolean
}

export default function GoLiveView({ client, isAdmin }: Props) {
  const router = useRouter()

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

  const telegramConnected = !!client.telegram_chat_id

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
            carrier={localCarrier}
            onCarrierChange={onCarrierChange}
            forwardingVerifiedAt={client.forwarding_verified_at}
            forwardingSelfAttested={!!client.forwarding_self_attested}
            onVerified={() => router.refresh()}
            scopedClientId={client.id}
            isAdmin={isAdmin}
          />
        </section>

        {/* ═══════════ Telegram (advisory one-liner) ═══════════ */}
        <section aria-labelledby="go-live-telegram-heading">
          <SectionHeader id="go-live-telegram-heading" title="Get notified" />
          <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className={`shrink-0 inline-block w-2.5 h-2.5 rounded-full ${
                  telegramConnected ? 'bg-emerald-500' : 'bg-zinc-300'
                }`}
              />
              <div className="min-w-0">
                <p className="text-base font-semibold text-zinc-900">
                  Telegram {telegramConnected ? 'connected' : 'not set up'}
                </p>
                <p className="text-sm text-zinc-600 mt-0.5">
                  {telegramConnected
                    ? "You'll get a ping the moment a call comes in."
                    : 'Connect Telegram to get instant call alerts on your phone.'}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings?tab=notifications"
              className="shrink-0 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
            >
              {telegramConnected ? 'Manage' : 'Connect'}
            </Link>
          </div>
        </section>

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
