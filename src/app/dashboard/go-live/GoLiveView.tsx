'use client'

/**
 * GoLiveView — slimmed 2026-04-28.
 *
 * Three blocks. Single font (Geist Sans). Anything dumber would be a screensaver.
 *
 *   HERO        — Twilio number, tap to copy
 *   FORWARDING  — <CallForwardingCard /> — carrier dial code + self-attest
 *   ALERTS      — email-first notification indicator + optional Telegram link
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
  hasTestCall?: boolean
  isAdmin: boolean
}

export default function GoLiveView({ client, hasTestCall = false, isAdmin }: Props) {
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
  const emailReady = client.email_notifications_enabled !== false && !!client.contact_email
  const knowledgeReady = Boolean(
    client.website_knowledge_approved ||
    client.gbp_summary ||
    (client.business_facts?.length ?? 0) > 0 ||
    (client.extra_qa?.length ?? 0) > 0 ||
    client.custom_niche_config,
  )
  const factCount = Array.isArray(client.business_facts) ? client.business_facts.length : 0
  const faqCount = client.extra_qa?.filter(pair => pair.q?.trim() && pair.a?.trim()).length ?? 0
  const knowledgeSources = [
    client.gbp_summary ? 'Google profile' : null,
    client.website_knowledge_approved ? 'website' : null,
    factCount > 0 ? `${factCount} fact${factCount !== 1 ? 's' : ''}` : null,
    faqCount > 0 ? `${faqCount} FAQ${faqCount !== 1 ? 's' : ''}` : null,
    client.custom_niche_config ? 'custom setup' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[600px] px-4 py-10 lg:py-12 space-y-10 lg:space-y-12">
        {/* ═══════════ HERO — Your number ═══════════ */}
        <section aria-labelledby="go-live-hero-heading">
          <h1 id="go-live-hero-heading" className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 text-center">
            Replace voicemail
          </h1>
          <p className="mt-3 text-center text-base text-zinc-600 max-w-md mx-auto">
            Your agent is not truly live until missed calls from your normal business number reach it.
          </p>

          {twilioNumber ? (
            <div className="text-center mt-8">
              <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Your AI number
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
                Forward missed calls here. Customers can keep calling your existing number.
              </p>
            </div>
          ) : (
            <div className="text-center mt-8">
              <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Your AI number
              </p>
              <p className="text-2xl font-semibold text-zinc-900">
                Your number is being assigned.
              </p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-sm font-medium text-zinc-900 transition-colors"
              >
                Check billing
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </section>

        <ReadinessChecklist
          hasNumber={!!twilioNumber}
          knowledgeReady={knowledgeReady}
          knowledgeDetail={knowledgeSources.length > 0 ? knowledgeSources.join(', ') : null}
          alertsReady={emailReady || telegramConnected}
          forwardingReady={isLive}
          hasTestCall={hasTestCall || isLive}
        />

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

        {/* ═══════════ Alerts (email-first, Telegram optional) ═══════════ */}
        <section aria-labelledby="go-live-telegram-heading">
          <SectionHeader id="go-live-telegram-heading" title="Get notified" />
          <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className={`shrink-0 inline-block w-2.5 h-2.5 rounded-full ${
                  emailReady || telegramConnected ? 'bg-emerald-500' : 'bg-zinc-300'
                }`}
              />
              <div className="min-w-0">
                <p className="text-base font-semibold text-zinc-900">
                  {emailReady ? 'Email summaries on' : telegramConnected ? 'Telegram connected' : 'Alerts not set up'}
                </p>
                <p className="text-sm text-zinc-600 mt-0.5">
                  {emailReady
                    ? `Call summaries go to ${client.contact_email}. Telegram is optional for faster pings.`
                    : telegramConnected
                      ? "You'll get a Telegram ping the moment a call comes in."
                      : 'Add an email or connect Telegram so every captured call reaches you.'}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings?tab=notifications"
              className="shrink-0 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
            >
              {emailReady || telegramConnected ? 'Manage' : 'Set up'}
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

function ReadinessChecklist({
  hasNumber,
  knowledgeReady,
  knowledgeDetail,
  alertsReady,
  forwardingReady,
  hasTestCall,
}: {
  hasNumber: boolean
  knowledgeReady: boolean
  knowledgeDetail: string | null
  alertsReady: boolean
  forwardingReady: boolean
  hasTestCall: boolean
}) {
  const items = [
    {
      label: 'AI number assigned',
      done: hasNumber,
      detail: hasNumber ? 'Ready for forwarding' : 'Usually finishes after checkout',
    },
    {
      label: 'Business knowledge loaded',
      done: knowledgeReady,
      detail: knowledgeReady && knowledgeDetail ? knowledgeDetail : knowledgeReady ? 'Agent has business context' : 'Add website, Google profile, services, or facts',
      href: '/dashboard/knowledge',
    },
    {
      label: 'Owner alerts ready',
      done: alertsReady,
      detail: alertsReady ? 'Summaries can reach you' : 'Email is the easiest default',
    },
    {
      label: 'Forwarding tested',
      done: forwardingReady,
      detail: forwardingReady ? 'Business number reaches the agent' : 'Call your normal number and let it miss',
    },
    {
      label: 'First test captured',
      done: hasTestCall,
      detail: hasTestCall ? 'Proof exists in call logs' : 'Run one real missed-call test',
    },
  ]
  const doneCount = items.filter(item => item.done).length

  return (
    <section aria-labelledby="voicemail-readiness-heading" className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id="voicemail-readiness-heading" className="text-base font-semibold text-zinc-900">
            Voicemail replacement readiness
          </h2>
          <p className="text-sm text-zinc-600 mt-1">
            {doneCount === items.length
              ? 'You are live: missed calls can be answered and summarized.'
              : 'Finish the pieces that make this a real voicemail replacement.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {doneCount}/{items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                item.done ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {item.done ? '✓' : '·'}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {'href' in item && item.href ? (
                  <Link href={item.href} className="hover:underline underline-offset-2">{item.label}</Link>
                ) : item.label}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const _CARRIER_KEYS = ['rogers', 'fido', 'bell', 'telus', 'koodo', 'virgin', 'freedom', 'other'] as const
function isValidCarrier(v: string): v is CarrierKey {
  return (_CARRIER_KEYS as readonly string[]).includes(v)
}
