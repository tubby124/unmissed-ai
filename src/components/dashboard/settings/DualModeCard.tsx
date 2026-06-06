'use client'

/**
 * DualModeCard — Wave 3 Layer C dashboard settings card.
 *
 * Controls two fields:
 *   - is_forwarding_personal_cell (boolean) — drives the universal PERSONAL
 *     flow trunk in prompt-slots.ts. Flipping it triggers slot regen + Ultravox
 *     sync via the settings PATCH route (FIELD_REGISTRY: triggersPatch='slot_regen').
 *   - carrier_id (string) — operational metadata, drives the MobileSetup card's
 *     dial-code rendering. DB_ONLY, no prompt impact.
 *
 * UX rule: keep the explanation in 2-3 sentences. The owner already saw the
 * full pitch during onboarding; this card is for "I changed my mind" toggles.
 */

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, Check, Phone, Smartphone } from 'lucide-react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { CARRIER_PROFILES, type CarrierId } from '@/types/carrier-compat'
import { usePatchSettings } from './usePatchSettings'

interface Props {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

const CARRIER_ORDER: CarrierId[] = [
  'rogers',
  'bell-mobility',
  'telus',
  'fido',
  'koodo',
  'freedom',
  'virgin-plus',
  'public-mobile',
  'chatr',
  'lucky-mobile',
  'videotron',
  'rogers-business',
  'telus-business',
  'pc-mobile',
  'other',
]

export default function DualModeCard({ client, isAdmin, previewMode }: Props) {
  const [forwardingPersonal, setForwardingPersonal] = useState<boolean>(
    client.is_forwarding_personal_cell !== false, // null → true (matches DB default)
  )
  const [carrierId, setCarrierId] = useState<string>(client.carrier_id ?? '')
  const { saving, saved, patch } = usePatchSettings(client.id, isAdmin)

  // Stay in sync when the parent prop refreshes (e.g. after a /recompose nudge).
  useEffect(() => {
    setForwardingPersonal(client.is_forwarding_personal_cell !== false)
    setCarrierId(client.carrier_id ?? '')
  }, [client.is_forwarding_personal_cell, client.carrier_id])

  async function save() {
    await patch({
      is_forwarding_personal_cell: forwardingPersonal,
      carrier_id: carrierId || null,
    })
  }

  const dirty =
    forwardingPersonal !== (client.is_forwarding_personal_cell !== false) ||
    (carrierId || '') !== (client.carrier_id ?? '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="rounded-2xl border b-theme bg-surface p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Call Routing</p>
          <p className="text-[11px] t3 mt-0.5">
            Tells the agent whether to treat off-topic callers like personal voicemail
            or like wrong-number business filter.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || previewMode}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500 hover:bg-blue-400 text-white'
          } disabled:opacity-40`}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Saved
            </span>
          ) : (
            'Save'
          )}
        </button>
      </div>

      {/* Forwarding mode */}
      <div className="mt-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold">Forwarding your personal cell?</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForwardingPersonal(true)}
            disabled={previewMode}
            className={`text-left px-3 py-2.5 rounded-lg border-2 text-xs transition ${
              forwardingPersonal
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-border hover:border-blue-500/30'
            } disabled:opacity-50`}
          >
            <div className="font-medium mb-0.5 t1">Yes — personal + business</div>
            <div className="t3 text-[11px] leading-snug">
              Family, deliveries, service providers get a warm message. Agent never
              hangs up with &ldquo;wrong number&rdquo;.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setForwardingPersonal(false)}
            disabled={previewMode}
            className={`text-left px-3 py-2.5 rounded-lg border-2 text-xs transition ${
              !forwardingPersonal
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-border hover:border-blue-500/30'
            } disabled:opacity-50`}
          >
            <div className="font-medium mb-0.5 t1">No — business line only</div>
            <div className="t3 text-[11px] leading-snug">
              Off-topic callers get a polite exit. Use this if you have a separate
              personal cell or a front desk.
            </div>
          </button>
        </div>
      </div>

      {/* Carrier */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold">Your mobile carrier</h4>
        </div>
        <select
          value={carrierId}
          onChange={(e) => setCarrierId(e.target.value)}
          disabled={previewMode}
          className="w-full rounded-md border b-theme bg-surface px-3 py-2 text-xs"
        >
          <option value="">Not set</option>
          {CARRIER_ORDER.map((id) => (
            <option key={id} value={id}>
              {CARRIER_PROFILES[id].displayName}
            </option>
          ))}
        </select>
        {carrierId && carrierId !== 'other' && (
          <p className="text-[10px] t3 mt-1.5">
            Support: {CARRIER_PROFILES[carrierId as CarrierId].supportNumber}
            {CARRIER_PROFILES[carrierId as CarrierId].requiresAddon && (
              <span className="block text-amber-500 mt-0.5">
                ⚠ Requires a Call Forwarding add-on on your plan.
              </span>
            )}
          </p>
        )}
      </div>
    </motion.div>
  )
}
