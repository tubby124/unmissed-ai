"use client";

import { motion } from "motion/react";
import { Check, Star, CalendarCheck } from "lucide-react";
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
  const hasBookingMode = data.agentMode === 'appointment_booking';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start free for 7 days. No credit card required.
        </p>
      </div>

      {/* Booking mode nudge — only shown when user picked "Help callers book appointments" */}
      {hasBookingMode && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2.5">
          <CalendarCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
            You selected <strong>Calendar Booking</strong> mode. This is included in your 7-day trial — after that, it requires <strong>Pro plan</strong> to stay active.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const id = plan.id as PlanId;
          const isSelected = selected === id;
          const highlights = PLAN_HIGHLIGHTS[id];
          const showBookingWarning = hasBookingMode && isSelected && id !== 'pro';

          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onUpdate({ selectedPlan: id })}
              whileTap={{ scale: 0.99 }}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                  : plan.isPopular || (hasBookingMode && id === 'pro')
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
                    {plan.isPopular && !hasBookingMode && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        <Star size={9} fill="currentColor" /> Most Popular
                      </span>
                    )}
                    {hasBookingMode && id === 'pro' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        <CalendarCheck size={9} /> Includes booking
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

                  {/* Plan mismatch warning — booking mode selected but this plan doesn't include it */}
                  {showBookingWarning && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Calendar booking won&apos;t be active after your trial on this plan.
                    </p>
                  )}
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
