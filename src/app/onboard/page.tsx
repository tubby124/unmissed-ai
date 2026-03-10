"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { OnboardingData, defaultOnboardingData } from "@/types/onboarding";
import Step1 from "./steps/step1";
import Step2 from "./steps/step2";
import Step3 from "./steps/step3";
import Step4 from "./steps/step4";
import Step5 from "./steps/step5";
import Step6 from "./steps/step6";
import Step7 from "./steps/step7";

const STORAGE_KEY = "unmissed-onboard-draft";

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

const STEP_TITLES = [
  "Your industry",
  "Business basics",
  "Hours",
  "Your services",
  "Notifications",
  "Preferences",
  "Review & activate",
];

const TOTAL_STEPS = 7;

function canAdvance(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1: return !!data.niche;
    case 2:
      return !!data.businessName && !!data.city && !!data.state
        && countDigits(data.callbackPhone) >= 10
        && !!data.contactEmail.trim();
    case 3: {
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
      for (const day of days) {
        const h = data.hours[day];
        if (!h.closed && h.open && h.close && h.close <= h.open) return false;
      }
      if (data.afterHoursBehavior === "route_emergency" && countDigits(data.emergencyPhone) < 10) {
        return false;
      }
      return true;
    }
    case 4: return true;
    case 5: {
      if (!data.notificationMethod) return false;
      const m = data.notificationMethod;
      if ((m === "sms" || m === "both") && countDigits(data.notificationPhone) < 10) return false;
      if ((m === "email" || m === "both") && !data.notificationEmail.trim()) return false;
      return true;
    }
    case 6: return true;
    case 7: return true;
    default: return true;
  }
}

// Step indicator — numbered circles with connecting lines
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-4">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-all duration-300
                ${done ? "bg-indigo-600 text-white" : active ? "ring-2 ring-indigo-600 text-indigo-600 bg-white" : "bg-gray-100 text-gray-400"}
              `}
            >
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </div>
            {n < total && (
              <div className={`w-6 sm:w-10 h-0.5 transition-colors duration-300 ${done ? "bg-indigo-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        if (parsed.step) setStep(parsed.step);
      }
    } catch { /* ignore malformed localStorage */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    } catch { /* localStorage full — silently ignore */ }
  }, [step, data]);

  const update = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleActivate = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submission failed");
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      router.push("/onboard/status");
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-indigo-600 tracking-tight">unmissed.ai</span>
          <span className="hidden sm:block text-gray-300 text-xs">·</span>
          <span className="hidden sm:block text-xs text-gray-400">Set up your AI agent — ~5 min</span>
        </div>
        <div className="text-xs text-gray-400 font-medium">
          {step} / {TOTAL_STEPS}
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b">
        <StepIndicator current={step} total={TOTAL_STEPS} />
        <div className="text-center pb-3">
          <span className="text-xs font-medium text-indigo-600">{STEP_TITLES[step - 1]}</span>
        </div>
      </div>

      {/* Step content — animated */}
      <div className="flex-1 flex justify-center px-4 py-6 overflow-hidden">
        <div className="w-full max-w-lg">
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
              {step === 2 && <Step2 data={data} onUpdate={update} />}
              {step === 3 && <Step3 data={data} onUpdate={update} />}
              {step === 4 && <Step4 data={data} onUpdate={update} />}
              {step === 5 && <Step5 data={data} onUpdate={update} />}
              {step === 6 && <Step6 data={data} onUpdate={update} />}
              {step === 7 && <Step7 data={data} onEdit={(s) => { setDirection(s < step ? -1 : 1); setStep(s); }} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer nav */}
      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 1}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            ← Back
          </Button>

          <div className="flex items-center gap-3">
            {error && (
              <p className="text-xs text-red-600 max-w-[200px] text-right">{error}</p>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                onClick={goNext}
                disabled={!canGoNext}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 cursor-pointer disabled:cursor-not-allowed"
              >
                Continue →
              </Button>
            ) : (
              <Button
                onClick={handleActivate}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 cursor-pointer"
              >
                {isSubmitting ? "Activating..." : "Activate My Agent →"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
