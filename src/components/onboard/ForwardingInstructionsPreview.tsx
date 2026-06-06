'use client'

/**
 * Post-activation "dial these codes" card.
 *
 * Reads `carrierId` + `forwardingTarget` (the assigned AI Twilio number)
 * surfaced from /api/public/agent-snapshot and renders the three GSM
 * conditional-CF codes the owner needs to dial on their personal line so
 * unanswered calls forward to the AI.
 *
 * Surface: TrialSuccessScreen. The component is intentionally inert without
 * a real forwardingTarget — pre-activation we have no AI number yet, so no
 * card is shown.
 *
 * For the dashboard equivalent (with full carrier picker + voicemail-removal
 * pre-flight) see src/components/dashboard/setup/MobileSetup.tsx.
 *
 * Wave 3 Layer C follow-up — Projects/unmissed/NEXT-CHAT-wave-3-followup-2026-06-07.md
 */

import { CARRIER_PROFILES, type CarrierId } from '@/types/carrier-compat'
import { formatPhone } from '@/lib/format-phone'
import { Phone } from 'lucide-react'

interface Props {
  carrierId: string | null | undefined
  forwardingTarget: string | null | undefined
}

export default function ForwardingInstructionsPreview({ carrierId, forwardingTarget }: Props) {
  if (!carrierId || !forwardingTarget) return null
  const profile = CARRIER_PROFILES[carrierId as CarrierId]
  if (!profile) return null

  const target = forwardingTarget.replace(/\D/g, '')
  const displayTarget = formatPhone(forwardingTarget)
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
          Forward your {profile.displayName} line to {displayTarget}
        </p>
      </div>

      <p className="text-[12px] t2 leading-relaxed">
        Dial these three codes on your {profile.displayName} phone. Your number keeps ringing
        first — the AI only picks up if you miss the call.
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
          error, our team will help sort it out from the dashboard.
        </p>
      )}
    </div>
  )
}
