"use client";

/**
 * Onboarding Step — Call Routing (Wave 3 Layer C).
 *
 * Two questions:
 *   1. "Will you be forwarding your personal cell to this number?"
 *        → drives clients.is_forwarding_personal_cell + prompt-slots PERSONAL
 *          flow trunk. Default YES, because almost every solo
 *          realtor/contractor/dentist forwards their cell.
 *   2. "What's your carrier?"
 *        → drives clients.carrier_id so the dashboard MobileSetup card can
 *          show the right conditional-CF codes (*61 / *67 / *62) +
 *          carrier-specific support number + voicemail-removal script.
 *
 * Both fields are optional in the strict sense (defaults apply) but we make
 * the carrier question functionally required for personal-cell-forwarding
 * users so we can give them accurate setup instructions immediately after
 * activation.
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, Phone, Building2, Smartphone } from "lucide-react";
import type { OnboardingData } from "@/types/onboarding";
import { CARRIER_PROFILES } from "@/types/carrier-compat";
import type { CarrierId } from "@/types/carrier-compat";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

// Show the most common Canadian carriers first, then alphabetical
const CARRIER_ORDER: CarrierId[] = [
  "rogers",
  "bell-mobility",
  "telus",
  "fido",
  "koodo",
  "freedom",
  "virgin-plus",
  "public-mobile",
  "chatr",
  "lucky-mobile",
  "videotron",
  "rogers-business",
  "telus-business",
  "pc-mobile",
  "other",
];

export default function StepRouting({ data, onUpdate }: Props) {
  const forwardingPersonal = data.isForwardingPersonalCell ?? true;
  const carrierId = (data.carrierId ?? "") as CarrierId | "";

  const carrierOptions = useMemo(() => {
    return CARRIER_ORDER.map((id) => ({
      id,
      label: CARRIER_PROFILES[id].displayName,
    }));
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-semibold mb-1">How should this number behave?</h2>
        <p className="text-sm text-muted-foreground mb-8">
          We need to know what calls your agent will get and which carrier handles your
          forwarding — so we can set the agent up to sound right and give you the exact
          dial codes after.
        </p>

        {/* Question 1 — Forwarding personal cell? */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-base font-medium">
              Will you be forwarding your personal cell to this number?
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onUpdate({ isForwardingPersonalCell: true })}
              className={`text-left p-4 rounded-lg border-2 transition ${
                forwardingPersonal
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium">Yes — it&apos;s my personal cell too</div>
                {forwardingPersonal && <Check className="w-4 h-4 text-primary shrink-0 mt-1" />}
              </div>
              <div className="text-xs text-muted-foreground">
                Family, friends, deliveries, service providers, appointment confirmations —
                agent takes a warm message and lets you know. Won&apos;t funnel personal
                callers into a business intake.
              </div>
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ isForwardingPersonalCell: false })}
              className={`text-left p-4 rounded-lg border-2 transition ${
                !forwardingPersonal
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-medium">No — business line only</div>
                {!forwardingPersonal && <Check className="w-4 h-4 text-primary shrink-0 mt-1" />}
              </div>
              <div className="text-xs text-muted-foreground">
                Only business inquiries reach this number. Off-topic callers get a polite
                exit. Use this if you have a separate cell or a front desk that handles
                personal calls.
              </div>
            </button>
          </div>

          {forwardingPersonal && (
            <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
              <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Recommended for solo realtors, contractors, dentists, and anyone without a
                front desk. You can change this anytime in dashboard → Settings → Call
                Routing.
              </span>
            </div>
          )}
        </div>

        {/* Question 2 — Carrier */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-base font-medium">What&apos;s your mobile carrier?</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            After activation we&apos;ll show you the exact dial codes to forward
            unanswered, busy, and out-of-range calls — they&apos;re different per carrier.
          </p>

          <select
            value={carrierId}
            onChange={(e) => onUpdate({ carrierId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">Select your carrier…</option>
            {carrierOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {carrierId && carrierId !== "other" && (
            <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {CARRIER_PROFILES[carrierId as CarrierId].displayName}:
              </span>{" "}
              Support {CARRIER_PROFILES[carrierId as CarrierId].supportNumber}
              {CARRIER_PROFILES[carrierId as CarrierId].requiresAddon && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  Heads up — this carrier requires a Call Forwarding add-on (~$3–5/mo)
                  on your plan before conditional forwarding works.
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
