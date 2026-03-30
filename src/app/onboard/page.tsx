"use client";

/**
 * Onboarding Shell — page.tsx
 *
 * Owns:  step state machine, navigation, localStorage persistence,
 *        activation API call, shell layout (top bar, progress, sidebar, footer nav).
 *
 * Does NOT own: step content — each step is its own file under ./steps/.
 *
 * ── HOW TO CHANGE THE FLOW ─────────────────────────────────────────────────
 * See src/app/onboard/config/steps.ts — edit STEP_DEFS there.
 * This file should rarely need to change unless you're updating the shell UI.
 *
 * ── HOW TO CHANGE SIDEBAR COPY ─────────────────────────────────────────────
 * Edit SIDEBAR_BENEFITS below (scroll down ~30 lines).
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { OnboardingData, defaultOnboardingData } from "@/types/onboarding";
import { BRAND_NAME } from "@/lib/brand";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { trackEvent } from "@/lib/analytics";
import { loadVisitor } from "@/lib/demo-visitor";
import { createBrowserClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { STEP_DEFS, TOTAL_STEPS, type ActivationContext } from "./config/steps";
import { ProvisioningOverlay } from "@/components/onboard/ProvisioningOverlay";
import { Check, Phone, Calendar, MessageSquare, Zap } from "lucide-react";

// ── Sidebar content — edit these to change the left-panel marketing copy ──────
const SIDEBAR_BENEFITS: { icon: React.ReactNode; text: string }[] = [
  { icon: <Phone className="w-4 h-4" />, text: "Answers every call, 24/7" },
  { icon: <Calendar className="w-4 h-4" />, text: "Books appointments automatically" },
  { icon: <MessageSquare className="w-4 h-4" />, text: "Texts callers a summary" },
  { icon: <Zap className="w-4 h-4" />, text: "No contracts. Cancel anytime." },
];

const SIDEBAR_PRICING = {
  label: "Free trial",
  price: "$0",
  period: "today",
  footnote: "No card required to try",
};
// ──────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = STORAGE_KEYS.ONBOARD_DRAFT;

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

  // step is 1-based; stepIndex is 0-based
  const stepIndex = step - 1;
  const stepDef = STEP_DEFS[stepIndex];

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
    if (step < TOTAL_STEPS) {
      setDirection(1);
      trackEvent("onboard_step_complete", { step, niche: data.niche || "none" });
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createBrowserClient();

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
          throw new Error(json.detail || json.error || "Trial signup failed");
        }
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);

        // Auto-login: provision creates user with QWERTY123 default password.
        // If sign-in succeeds, go straight to the dashboard (which auto-redirects
        // trial users to /dashboard/welcome). If it fails, fall back to the
        // trial success screen with password hint.
        const email = data.contactEmail?.trim();
        if (email && supabaseRef.current) {
          const { error: loginErr } = await supabaseRef.current.auth.signInWithPassword({
            email,
            password: 'QWERTY123',
          });
          if (!loginErr) {
            trackEvent("onboard_auto_login", { success: true });
            router.push("/dashboard");
            return;
          }
          console.warn('[onboard] Auto-login failed, falling back to success screen:', loginErr.message);
        }

        // Fallback: send to TrialSuccessScreen (with password hint visible)
        router.push(
          `/onboard/status?trial=true&clientId=${json.clientId}&agentName=${encodeURIComponent(json.agentName || "")}&telegramLink=${encodeURIComponent(json.telegramLink || "")}&email=${encodeURIComponent(data.contactEmail || "")}&knowledgeCount=${json.knowledgeCount ?? 0}${json.setupUrl ? `&setupUrl=${encodeURIComponent(json.setupUrl)}` : ""}`
        );
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

  const canGoNext = stepDef?.canAdvance(data) ?? true;
  const isLastStep = step === TOTAL_STEPS;
  const progressValue = Math.max(8, Math.round((stepIndex / (TOTAL_STEPS - 1)) * 100));

  // Props for the activation step
  const activationCtx: ActivationContext = {
    onActivate: handleActivate,
    isSubmitting,
    error,
    canActivate: canGoNext,
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-primary tracking-tight">
          {BRAND_NAME}
        </span>
        <ThemeToggle />
      </div>

      {/* Labeled step progress */}
      <div className="shrink-0 px-4 pb-3">
        <div className="flex items-center gap-1 max-w-lg mx-auto">
          {STEP_DEFS.map((def, i) => {
            const isComplete = i < stepIndex;
            const isCurrent = i === stepIndex;
            return (
              <div key={i} className="flex items-center flex-1 min-w-0 last:flex-none">
                {/* Step dot */}
                <div className="flex flex-col items-center gap-1">
                  <motion.div
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors shrink-0",
                      isComplete
                        ? "bg-indigo-600 text-white"
                        : isCurrent
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-600/20"
                          : "bg-muted text-muted-foreground",
                    ].join(" ")}
                    animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {isComplete ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </motion.div>
                  <span className={[
                    "text-[10px] font-medium hidden sm:block whitespace-nowrap",
                    isCurrent ? "text-indigo-600 dark:text-indigo-400" : isComplete ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}>
                    {def.label}
                  </span>
                </div>
                {/* Connector line */}
                {i < STEP_DEFS.length - 1 && (
                  <div className={[
                    "flex-1 h-0.5 mx-1 rounded-full transition-colors mt-[-18px] sm:mt-0",
                    isComplete ? "bg-indigo-600" : "bg-muted",
                  ].join(" ")} />
                )}
              </div>
            );
          })}
        </div>
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
              {SIDEBAR_BENEFITS.map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="text-indigo-400 shrink-0 mt-0.5">{icon}</span>
                  <span className="text-sm text-indigo-200 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl bg-indigo-900/60 border border-indigo-800/60 p-4 space-y-1">
              <p className="text-xs font-semibold text-indigo-300">{SIDEBAR_PRICING.label}</p>
              <p className="text-2xl font-bold text-white">
                {SIDEBAR_PRICING.price}{" "}
                <span className="text-sm font-normal text-indigo-300">{SIDEBAR_PRICING.period}</span>
              </p>
              <p className="text-xs text-indigo-400">{SIDEBAR_PRICING.footnote}</p>
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
                    {STEP_DEFS.map((def, i) => {
                      if (step !== i + 1) return null;
                      const StepComponent = def.component;
                      const extraProps = def.activationProps ? activationCtx : {};
                      return (
                        <StepComponent
                          key={i + 1}
                          data={data}
                          onUpdate={update}
                          {...extraProps}
                        />
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer nav */}
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

                {!isLastStep && !stepDef?.hideFooterCta && (
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
      <ProvisioningOverlay data={data} visible={isSubmitting} />
    </div>
  );
}
