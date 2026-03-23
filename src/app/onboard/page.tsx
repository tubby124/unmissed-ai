"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { OnboardingData, defaultOnboardingData, Niche } from "@/types/onboarding";
import Step1 from "./steps/step1";
import Step2Voice from "./steps/step2-voice";
import Step4 from "./steps/step4";
import Step6Review from "./steps/step6-review";
import ThemeToggle from "@/components/ThemeToggle";
import { BRAND_NAME } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { trackEvent } from "@/lib/analytics";
import { loadVisitor } from "@/lib/demo-visitor";

const STORAGE_KEY = STORAGE_KEYS.ONBOARD_DRAFT;

function getStepSequence(niche: Niche | null): number[] {
  if (niche === "voicemail") return [1, 2, 6]; // skip Knowledge (4)
  return [1, 2, 4, 6]; // 4-step flow: Business → Agent → Knowledge → Review
}

const STEP_TITLES: Record<number, string> = {
  1: "Your business",
  2: "Your agent",
  4: "Knowledge & FAQ",
  6: "Review & activate",
};

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function canAdvance(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1: {
      // Combined: niche selection + business details (old steps 1+3)
      if (!data.niche) return false;
      const isVM = data.niche === "voicemail";
      const baseValid = !!data.businessName
        && countDigits(data.callbackPhone) >= 10
        && isValidEmail(data.contactEmail);
      if (data.niche === "real_estate") return baseValid && !!data.ownerName?.trim() && !!data.businessHoursText?.trim();
      if (isVM) return baseValid;
      return baseValid && !!data.city && !!data.businessHoursText?.trim();
    }
    case 2: return true; // voice + call handling have defaults
    case 4: return true; // knowledge + FAQ optional
    case 6: return true; // review page
    default: return true;
  }
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 px-4">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div
            key={n}
            className={`rounded-full transition-all duration-300 ${
              active
                ? "w-6 h-2 bg-indigo-600"
                : done
                ? "w-2 h-2 bg-indigo-400"
                : "w-2 h-2 bg-muted-foreground/25"
            }`}
          />
        );
      })}
    </div>
  );
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
        // G10: stale localStorage fix — old 7-step wizard saved step > 6
        return s > 6 ? 1 : s;
      }
    } catch { /* ignore */ }
    return 1;
  });
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
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
  const [showTrainingAnimation, setShowTrainingAnimation] = useState(false);
  const trainingShownRef = useRef(false);

  const stepSequence = getStepSequence(data.niche);
  const stepIndex = stepSequence.indexOf(step);
  const totalSteps = stepSequence.length;

  // Reset to step 1 if niche changes and current step is no longer in the new sequence
  useEffect(() => {
    if (!stepSequence.includes(step)) {
      setStep(1);
    }
  }, [data.niche]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!data.timezone) {
      update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill from demo visitor localStorage (name/email/phone collected on /try or widget)
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
      trackEvent('onboard_step_complete', { step, niche: data.niche || 'none' });
      // Training animation: only once, only when step 1→2 with a business name
      if (step === 1 && data.businessName && !trainingShownRef.current) {
        trainingShownRef.current = true;
        setShowTrainingAnimation(true);
        setTimeout(() => {
          setShowTrainingAnimation(false);
          setStep(stepSequence[stepIndex + 1]);
        }, 2000);
        return;
      }
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
    trackEvent('onboard_submit', { mode, niche: data.niche || 'none' });
    try {
      if (mode === "trial") {
        const res = await fetch("/api/provision/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Trial signup failed");
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
        router.push(`/onboard/status?trial=true&clientId=${json.clientId}&setupUrl=${encodeURIComponent(json.setupUrl || '')}&telegramLink=${encodeURIComponent(json.telegramLink || '')}`);
      } else {
        // Existing paid path
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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
  };

  const canGoNext = canAdvance(step, data);
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <>
      {/* Training animation overlay */}
      {showTrainingAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="text-center space-y-4 px-8 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-foreground">
              Training your agent on {data.businessName}...
            </p>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: '100%', transition: 'width 1.9s ease-out', transitionDelay: '0.05s' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="min-h-screen flex flex-col bg-muted/30">
        {/* Header */}
        <div className="bg-background border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-600 tracking-tight">{BRAND_NAME}</span>
            <span className="hidden sm:block text-muted-foreground/70 text-xs">·</span>
            <span className="hidden sm:block text-xs text-muted-foreground">Set up your AI agent — ~5 min</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-xs text-muted-foreground font-medium">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="bg-background border-b">
          <StepIndicator current={stepIndex + 1} total={totalSteps} />
          <div className="text-center pb-3">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{STEP_TITLES[step]}</span>
          </div>
        </div>

        {/* Step content — animated */}
        <div className="flex-1 flex justify-center px-4 py-8 overflow-hidden">
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {step === 1 && <Step1 data={data} onUpdate={update} />}
                {step === 2 && <Step2Voice data={data} onUpdate={update} />}
                {step === 4 && <Step4 data={data} onUpdate={update} />}
                {step === 6 && (
                  <Step6Review
                    data={data}
                    stepSequence={stepSequence}
                    onEdit={(s) => { setDirection(s < step ? -1 : 1); setStep(s); }}
                    onActivate={handleActivate}
                    onUpdate={update}
                    isSubmitting={isSubmitting}
                    error={error}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer nav */}
        <div className="bg-background border-t px-4 py-4 sticky bottom-0 z-10">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              &larr; Back
            </Button>

            <div className="flex items-center gap-3">
              {!isLastStep && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={goNext}
                    disabled={!canGoNext}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Continue &rarr;
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
