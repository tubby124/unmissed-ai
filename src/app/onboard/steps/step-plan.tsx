"use client";

import { motion } from "motion/react";
import { Check, Star } from "lucide-react";
import { OnboardingData } from "@/types/onboarding";
import { PUBLIC_PLANS } from "@/lib/pricing";
import { planToMode } from "@/lib/plan-entitlements";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

type PlanId = "lite" | "core" | "pro";

// Phase 7: Plan = Mode. Lite = Smart Voicemail, Core = AI Receptionist, Pro = AI Receptionist Pro
const PLAN_HIGHLIGHTS: Record<PlanId, string[]> = {
  lite: [
    "24/7 call answering",
    "Captures name, number & reason",
    "SMS follow-up to every caller",
  ],
  core: [
    "Full AI receptionist (answers live)",
    "Calendar booking (Google Calendar)",
    "Website & Google knowledge base",
    "Lead scoring (HOT / WARM / COLD)",
  ],
  pro: [
    "Everything in AI Receptionist",
    "IVR call menu — route before agent",
    "Live call transfer to your phone",
    "1,000 minutes for high volume",
  ],
};

export default function StepPlan({ data, onUpdate }: Props) {
  const selected = data.selectedPlan as PlanId | null;

  // Phase 7: Plan = Mode. Selecting a plan auto-derives the agent mode.
  const handleSelectPlan = (id: PlanId) => {
    const mode = planToMode(id);
    onUpdate({
      selectedPlan: id,
      agentMode: mode,
      // Derive call_handling_mode for backwards compat
      callHandlingMode: mode === 'appointment_booking' ? 'full_service'
        : mode === 'voicemail_replacement' ? 'message_only'
        : 'triage',
      // Auto-enable booking for Pro
      ...(id === 'pro' ? { callForwardingEnabled: true } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your 7-day trial includes <strong className="text-foreground">everything</strong>. Pick what to keep after. No credit card now.
        </p>
      </div>

      {/* Trial banner */}
      <div className="text-center py-2 px-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          7-day free trial, no credit card required
        </p>
      </div>

      <div className="space-y-3">
        {PUBLIC_PLANS.map((plan) => {
          const id = plan.id as PlanId;
          const isSelected = selected === id;
          const isCenterStage = id === 'core';
          const highlights = PLAN_HIGHLIGHTS[id];

          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => handleSelectPlan(id)}
              whileTap={{ scale: 0.99 }}
              className={[
                "w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer",
                isSelected
                  ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30"
                  : isCenterStage
                    ? "border-indigo-200 dark:border-indigo-800/60 bg-card hover:border-indigo-400"
                    : "border-border bg-card hover:border-muted-foreground/40",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-border bg-background"
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{plan.name}</span>
                    {isCenterStage && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        <Star size={9} fill="currentColor" /> Popular
                      </span>
                    )}
                    <span className="ml-auto font-bold text-foreground">
                      ${plan.monthly}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </span>
                  </div>

                  <ul className="space-y-1 mt-2">
                    {highlights.map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Social proof */}
      <p className="text-center text-xs text-muted-foreground">
        Trusted by auto shops, restaurants, and property managers across Canada
      </p>
    </div>
  );
}
