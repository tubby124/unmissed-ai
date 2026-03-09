"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  "Pick your industry",
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
      // Validate that no open day has close <= open
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
      for (const day of days) {
        const h = data.hours[day];
        if (!h.closed && h.open && h.close && h.close <= h.open) {
          return false;
        }
      }
      return true;
    }
    case 4: return true; // niche questions are optional-ish
    case 5: {
      if (!data.notificationMethod) return false;
      const method = data.notificationMethod;
      if ((method === "sms" || method === "both") && countDigits(data.notificationPhone) < 10) {
        return false;
      }
      if ((method === "email" || method === "both") && !data.notificationEmail.trim()) {
        return false;
      }
      return true;
    }
    case 6: return true;
    case 7: return true;
    default: return true;
  }
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        if (parsed.step) setStep(parsed.step);
      }
    } catch {
      // Ignore malformed localStorage
    }
    hydrated.current = true;
  }, []);

  // Persist to localStorage on every change (after initial hydration)
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }, [step, data]);

  const update = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
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
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      router.push("/onboard/status");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">
          Set up your AI agent
        </div>
        <div className="text-xs text-gray-400">
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b px-4 pb-3">
        <Progress value={progress} className="h-1.5" />
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {STEP_TITLES.map((title, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i + 1 < step && setStep(i + 1)}
              className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 transition-colors
                ${i + 1 === step
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : i + 1 < step
                  ? "text-gray-500 hover:text-gray-700 cursor-pointer"
                  : "text-gray-300 cursor-default"
                }`}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex justify-center px-4 py-6">
        <div className="w-full max-w-lg">
          {step === 1 && <Step1 data={data} onUpdate={update} />}
          {step === 2 && <Step2 data={data} onUpdate={update} />}
          {step === 3 && <Step3 data={data} onUpdate={update} />}
          {step === 4 && <Step4 data={data} onUpdate={update} />}
          {step === 5 && <Step5 data={data} onUpdate={update} />}
          {step === 6 && <Step6 data={data} onUpdate={update} />}
          {step === 7 && <Step7 data={data} onEdit={(s) => setStep(s)} />}
        </div>
      </div>

      {/* Footer nav */}
      <div className="bg-white border-t px-4 py-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 1}
          className="text-gray-600"
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
              disabled={!canAdvance(step, data)}
            >
              Continue →
            </Button>
          ) : (
            <Button
              onClick={handleActivate}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {isSubmitting ? "Activating..." : "Activate My Agent →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
