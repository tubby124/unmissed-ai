"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { OnboardingData, nicheLabels } from "@/types/onboarding";

// ── Message copy ─────────────────────────────────────────────────────────────
// Edit this function to change what users see during provisioning.
// Each string maps to one stage of the actual backend work.
export function buildProvisioningMessages(data: OnboardingData): string[] {
  const name    = data.agentName    || "your agent";
  const biz     = data.businessName || "your business";
  const city    = data.city         || "your area";
  const niche   = nicheLabels[data.niche ?? "other"] ?? "your industry";
  const hasWeb  = !!data.websiteUrl;
  const rating  = data.placesRating;
  const reviews = data.placesReviewCount;

  return [
    `Saving ${biz}'s profile…`,
    hasWeb
      ? `Preparing knowledge from ${biz}'s website…`
      : `Building ${name}'s knowledge for ${niche}…`,
    `Crafting ${name}'s voice and personality…`,
    rating && reviews
      ? `${name} will represent your ${rating}★ reputation to callers in ${city}…`
      : `Connecting ${name} to the call network in ${city}…`,
    `${name} is almost ready for ${biz}…`,
  ];
}

// ── Progress targets per message index ───────────────────────────────────────
// Message-driven, not time-linear.  Each advance jumps to a target; the bar
// drifts slowly toward 88 between jumps so it always feels alive.
const MESSAGE_PROGRESS = [12, 32, 52, 70, 82] as const;

// ── Component ─────────────────────────────────────────────────────────────────
interface ProvisioningOverlayProps {
  data: OnboardingData;
  visible: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ProvisioningOverlay({ data, visible, error, onRetry }: ProvisioningOverlayProps) {
  const prefersReduced = useReducedMotion();
  const msgs = buildProvisioningMessages(data);

  const [idx, setIdx]           = useState(0);
  const [progress, setProgress] = useState(0);

  // Reset + start message cycle when overlay opens
  useEffect(() => {
    if (!visible) {
      setIdx(0);
      setProgress(0);
      return;
    }
    setIdx(0);
    setProgress(MESSAGE_PROGRESS[0]);
    const iv = setInterval(
      () => setIdx((i) => Math.min(i + 1, msgs.length - 1)),
      8_000,
    );
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Jump progress to message target, then drift toward 88
  useEffect(() => {
    if (!visible) return;
    const target = MESSAGE_PROGRESS[Math.min(idx, MESSAGE_PROGRESS.length - 1)];
    setProgress(target);
    const iv = setInterval(
      () => setProgress((p) => Math.min(88, p + 0.05)),
      200,
    );
    return () => clearInterval(iv);
  }, [idx, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="provisioning-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/95 backdrop-blur-sm"
        >
          {error ? (
            /* Phase 7: Error state — friendly message + retry + contact link */
            <div className="flex flex-col items-center gap-6 px-6 text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">Something went wrong</p>
                <p className="text-sm text-indigo-200">{error}</p>
              </div>
              <div className="flex items-center gap-3">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Try again
                  </button>
                )}
                <a
                  href="mailto:support@unmissed.ai"
                  className="px-4 py-2.5 rounded-xl border border-indigo-400/30 text-indigo-200 text-sm hover:bg-indigo-900/50 transition-colors"
                >
                  Contact us
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Orb — supporting role, not hero */}
              <VoicePoweredOrb
                externalEnergy={0.35}
                className="w-40 h-40 shrink-0"
              />

              {/* Message */}
              <div className="mt-8 h-8 flex items-center justify-center px-6 text-center">
                {prefersReduced ? (
                  <p className="text-sm font-medium text-indigo-100">
                    {msgs[idx]}
                  </p>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="text-sm font-medium text-indigo-100"
                    >
                      {msgs[idx]}
                    </motion.p>
                  </AnimatePresence>
                )}
              </div>

              {/* Visually hidden live region so screen readers announce each message */}
              <span className="sr-only">{msgs[idx]}</span>

              {/* Progress bar — pinned to bottom of overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-900/60">
                <div
                  className="h-full bg-indigo-400 transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                  aria-hidden="true"
                />
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
