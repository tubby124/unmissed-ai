'use client'

/**
 * Thin pre-launch wrapper around CARRIER_PROFILES.
 *
 * Reads `carrierId` from OnboardingData (captured in step-routing) and renders
 * the conditional-CF dial codes the owner will run AFTER activation. The actual
 * AI number ({{forwardTo}}) isn't known until provisioning assigns the Twilio
 * line, so we render `*61 [your AI number] #` as a placeholder pattern with a
 * short explainer.
 *
 * For the post-activation dashboard version see:
 *   src/components/dashboard/setup/MobileSetup.tsx
 *   src/components/dashboard/setup/CarrierCompatibilityCheck.tsx
 *
 * Wave 3 Layer C follow-up — surfaces clients.carrier_id at launch time so the
 * owner doesn't have to re-pick their carrier on the dashboard. Spec:
 *   ~/Downloads/Obsidian Vault/Projects/unmissed/NEXT-CHAT-wave-3-followup-2026-06-07.md
 */

import { CARRIER_PROFILES, type CarrierId } from '@/types/carrier-compat'
import { Phone } from 'lucide-react'

interface Props {
  carrierId: string | null | undefined
  forwardingNumberDisplay?: string | null
}

const PLACEHOLDER = '[your AI number]'

export default function ForwardingInstructionsPreview({ carrierId, forwardingNumberDisplay }: Props) {
  if (!carrierId) return null
  const profile = CARRIER_PROFILES[carrierId as CarrierId]
  if (!profile) return null

  const target = forwardingNumberDisplay?.trim() || PLACEHOLDER
  const rows: Array<{ code: string; condition: string }> = [
    { code: `*61*${target}#`, condition: "when you don't pick up" },
    { code: `*67*${target}#`, condition: 'when your line is busy' },
    { code: `*62*${target}#`, condition: 'when your phone is off or out of signal' },
  ]

  return (
    <div className="rounded-xl border b-theme bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="w-3.5 h-3.5 t3" />
        <p className="text-xs font-semibold tracking-[0.12em] uppercase t3">
          Forward your {profile.displayName} line
        </p>
      </div>

      <p className="text-[12px] t2 leading-relaxed">
        Right after activation, dial these three codes on your {profile.displayName} phone to
        forward unanswered calls to the AI line — your number keeps ringing first, the AI only
        picks up if you miss the call.
      </p>

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.code}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
          >
            <code className="text-[13px] font-mono t1">{r.code}</code>
            <span className="text-[11px] t3">{r.condition}</span>
          </div>
        ))}
      </div>

      {profile.escalationNote && (
        <p className="text-[11px] t3 leading-relaxed italic">
          Heads up — {profile.escalationNote}
        </p>
      )}
      {!profile.validated && (
        <p className="text-[11px] text-amber-500/80 leading-relaxed">
          {profile.displayName} hasn&apos;t been field-validated yet — if a code throws an
          error, our team will help you sort it out on the dashboard.
        </p>
      )}
    </div>
  )
}
