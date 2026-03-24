"use client";

import { motion } from "motion/react";
import { Check, Star } from "lucide-react";
import { OnboardingData } from "@/types/onboarding";
import { PLANS } from "@/lib/pricing";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

type PlanId = "lite" | "core" | "pro";

const PLAN_HIGHLIGHTS: Record<PlanId, string[]> = {
  lite: [
    "AI voicemail 24/7",
    "Captures name, number & reason",
    "Call summary texted to you",
  ],
  core: [
    "Full AI receptionist (answers live)",
    "Website & Google Business knowledge",
    "Lead scoring (HOT / WARM / COLD)",
    "Daily 8AM call digest",
  ],
  pro: [
    "Everything in Core",
    "Calendar booking (Google Calendar)",
    "Live call transfer to your phone",
    "Priority support",
  ],
};

export default function StepPlan({ data, onUpdate }: Props) {
  const selected = data.selectedPlan as PlanId | null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start free for 7 days. No credit card required.
        </p>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const id = plan.id as PlanId;
          const isSelected = selected === id;
          const highlights = PLAN_HIGHLIGHTS[id];

          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onUpdate({ selectedPlan: id })}
              whileTap={{ scale: 0.99 }}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                  : plan.isPopular
                  ? "border-indigo-200 dark:border-indigo-800/60 bg-card hover:border-indigo-400"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
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
                    {plan.isPopular && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        <Star size={9} fill="currentColor" /> Most Popular
                      </span>
                    )}
                    <span className="ml-auto font-bold text-foreground">
                      ${plan.monthly}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">{plan.tagline}</p>

                  <ul className="space-y-1">
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

      <p className="text-center text-xs text-muted-foreground">
        7-day free trial · No credit card required · Cancel anytime
      </p>
    </div>
  );
}
