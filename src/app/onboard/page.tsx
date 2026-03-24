"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { OnboardingData, defaultOnboardingData } from "@/types/onboarding";
import Step1GBP from "./steps/step1-gbp";
import Step2Job from "./steps/step2-job";
import Step3VoicePreview from "./steps/step2-voice-preview";
import StepPlan from "./steps/step-plan";
import Step5Capabilities from "./steps/step3-capabilities";
import Step6Schedule from "./steps/step4-schedule";
import Step7Activate from "./steps/step6-activate";
import { SegmentedProgress } from "@/components/ui/progress-bar";
import { BRAND_NAME } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { trackEvent } from "@/lib/analytics";
import { loadVisitor } from "@/lib/demo-visitor";
import ThemeToggle from "@/components/ThemeToggle";

const STORAGE_KEY = STORAGE_KEYS.ONBOARD_DRAFT;
const TOTAL_STEPS = 7;

const STEP_LABELS: Record<number, string> = {
  1: "Your business",
  2: "Agent's job",
  3: "Voice",
  4: "Your plan",
  5: "Capabilities",
  6: "Schedule",
  7: "Launch",
};

function getStepSequence(): number[] {
  return [1, 2, 3, 4, 5, 6, 7];
}

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function canAdvance(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1:
      return !!data.businessName && !!data.voiceId;
    case 2:
      return !!data.agentJob;
    case 3:
      return !!data.voiceId;
    case 4:
      return !!data.selectedPlan;
    case 5:
      return true;
    case 6:
      return true;
    case 7:
      return true;
    default:
      return true;
  }
}

export default function OnboardPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const s = typeof parsed.step === "number" ? parsed.step : 1;
        return s > TOTAL_STEPS ? 1 : s;
      }
    } catch { /* ignore */ }
    return 1;
  });

  const [direction, setDirection] = useState(1);

  const [data, setData] = useState<OnboardingData>(() => {
    if (typeof window === "undefined") return defaultOnboardingData;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data && typeof parsed.data === "object") {
          return { ...defaultOnboardingData, ...parsed.data };
        }
      }
    } catch { /* ignore */ }
    return defaultOnboardingData;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepSequence = getStepSequence();
  const stepIndex = stepSequence.indexOf(step);

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!data.timezone) {
      update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill from demo visitor localStorage
  useEffect(() => {
    const visitor = loadVisitor();
    if (!visitor) return;
    const prefill: Partial<OnboardingData> = {};
    if (visitor.name && !data.ownerName) prefill.ownerName = visitor.name;
    if (visitor.email && !data.contactEmail) prefill.contactEmail = visitor.email;
    if (visitor.phone && !data.callbackPhone) prefill.callbackPhone = visitor.phone;
    if (Object.keys(prefill).length > 0) update(prefill);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    } catch { /* localStorage full */ }
  }, [step, data]);

  const update = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    if (stepIndex < stepSequence.length - 1) {
      setDirection(1);
      trackEvent("onboard_step_complete", { step, niche: data.niche || "none" });
      setStep(stepSequence[stepIndex + 1]);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStep(stepSequence[stepIndex - 1]);
    }
  };

  const handleActivate = async (mode: "trial" | "paid") => {
    setIsSubmitting(true);
    setError(null);
    trackEvent("onboard_activate", { mode, niche: data.niche || "none" });
    try {
      if (mode === "trial") {
        const res = await fetch("/api/provision/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 422 && Array.isArray(json.errors) && json.errors.length > 0) {
            throw new Error(`Setup failed: ${json.errors.join(" · ")}`);
          }
          throw new Error(json.error || "Trial signup failed");
        }
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
        // If we have a recovery setup URL, send the user directly into password setup.
        // This avoids depending on email delivery for first-time access.
        if (json.setupUrl) {
          window.location.href = json.setupUrl;
        } else {
          router.push(
            `/onboard/status?trial=true&clientId=${json.clientId}&agentName=${encodeURIComponent(json.agentName || "")}&telegramLink=${encodeURIComponent(json.telegramLink || "")}&email=${encodeURIComponent(data.contactEmail || "")}&knowledgeCount=${json.knowledgeCount ?? 0}`
          );
        }
      } else {
        const res = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Submission failed");
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
        router.push(`/onboard/status?id=${json.jobId}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const canGoNext = canAdvance(step, data);
  const isLastStep = stepIndex === stepSequence.length - 1;
  const progressValue = Math.max(8, Math.round((stepIndex / (TOTAL_STEPS - 1)) * 100));

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-primary tracking-tight">
          {BRAND_NAME}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {TOTAL_STEPS} — {STEP_LABELS[step]}
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Progress strip */}
      <div className="shrink-0 px-4 pb-2">
        <SegmentedProgress
          value={progressValue}
          segments={TOTAL_STEPS * 4}
          showPercentage={false}
          showDemo={false}
          className="h-1.5"
        />
      </div>

      {/* Center area */}
      <div className="flex-1 flex items-start lg:items-center justify-center min-h-0 lg:px-6 lg:pb-6">

        {/* Card */}
        <div className="w-full max-w-4xl flex flex-col min-h-0 h-full lg:flex-row lg:h-[88vh] lg:rounded-2xl lg:border lg:border-border lg:shadow-xl overflow-hidden">

          {/* LEFT PANEL — benefit sidebar (desktop only) */}
          <div className="hidden lg:flex flex-col w-[260px] shrink-0 justify-center px-8 py-12 border-r border-border gap-6 bg-indigo-950 dark:bg-indigo-950">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">unmissed.ai</p>
              <h3 className="text-lg font-bold text-white leading-snug">
                Your AI receptionist,<br />live in minutes
              </h3>
            </div>
            <ul className="space-y-3">
              {[
                { icon: "📞", text: "Answers every call, 24/7" },
                { icon: "📅", text: "Books appointments automatically" },
                { icon: "💬", text: "Texts callers a summary" },
                { icon: "⚡", text: "No contracts. Cancel anytime." },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{icon}</span>
                  <span className="text-sm text-indigo-200 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl bg-indigo-900/60 border border-indigo-800/60 p-4 space-y-1">
              <p className="text-xs font-semibold text-indigo-300">Free trial</p>
              <p className="text-2xl font-bold text-white">$0 <span className="text-sm font-normal text-indigo-300">today</span></p>
              <p className="text-xs text-indigo-400">No card required to try</p>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex flex-col min-h-0 h-full bg-card">

            {/* Scrollable step content */}
            <div className="flex-1 overflow-y-auto px-5 lg:px-8 pb-4 pt-6 min-h-0">
              <div className="w-full max-w-lg mx-auto">

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {step === 1 && (
                      <Step1GBP data={data} onUpdate={update} />
                    )}
                    {step === 2 && (
                      <Step2Job data={data} onUpdate={update} />
                    )}
                    {step === 3 && (
                      <Step3VoicePreview data={data} onUpdate={update} />
                    )}
                    {step === 4 && (
                      <StepPlan data={data} onUpdate={update} />
                    )}
                    {step === 5 && (
                      <Step5Capabilities data={data} onUpdate={update} />
                    )}
                    {step === 6 && (
                      <Step6Schedule data={data} onUpdate={update} />
                    )}
                    {step === 7 && (
                      <Step7Activate
                        data={data}
                        onUpdate={update}
                        onActivate={handleActivate}
                        isSubmitting={isSubmitting}
                        error={error}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer nav — Back always visible; Continue hidden on last step (step 6 has its own Launch CTA) */}
            <div className="shrink-0 border-t border-border px-5 lg:px-8 py-4 bg-card">
              <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={stepIndex === 0}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ← Back
                </Button>

                {!isLastStep && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground min-h-[44px]"
                    >
                      Continue →
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
