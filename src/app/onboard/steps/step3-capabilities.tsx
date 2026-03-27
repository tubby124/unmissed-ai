"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_MODES, AgentMode } from "@/lib/capabilities";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step3Capabilities({ data, onUpdate }: Props) {
  const currentMode = data.callHandlingMode ?? "triage";
  const forwardingEnabled = data.callForwardingEnabled ?? false;
  const isPro = data.selectedPlan === "pro";

  function selectMode(mode: AgentMode) {
    onUpdate({ callHandlingMode: mode });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          What should {data.agentName || "your agent"} do?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the mode that fits your business. You can change this anytime.
        </p>
      </div>

      {/* Mode cards */}
      <div className="space-y-3">
        {AGENT_MODES.map((mode) => {
          const isSelected = currentMode === mode.id;
          // Booking mode is always selectable — just needs calendar connected later
          const needsCalendar = mode.id === "full_service";

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => selectMode(mode.id)}
              className={[
                "w-full text-left rounded-xl border p-4 transition-all cursor-pointer",
                isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                  : "border-border bg-card hover:border-indigo-300 dark:hover:border-indigo-700",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Radio dot */}
                <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center border-indigo-500">
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{mode.icon}</span>
                    <span className="font-semibold text-sm text-foreground">
                      {mode.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — {mode.tagline}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {mode.description}
                  </p>

                  {/* Quote preview + calendar note — only when selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-2 text-xs italic text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg px-3 py-2">
                          {mode.quote}
                        </p>
                        <ul className="mt-2 space-y-0.5">
                          {mode.included.map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <span className="text-emerald-500">✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        {needsCalendar && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                            You&apos;ll connect your Google Calendar from your dashboard to activate booking.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Add-ons ── */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Add-ons
        </p>

        {/* Call forwarding toggle */}
        <div
          className={[
            "rounded-xl border p-4 transition-all",
            forwardingEnabled && isPro
              ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-border bg-card",
            !isPro ? "opacity-60" : "",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  📞 Call Forwarding
                </span>
                {!isPro && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    Pro plan
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Transfer urgent calls to your phone — available after activation.
              </p>
            </div>
            {/* Toggle */}
            <button
              type="button"
              disabled={!isPro}
              onClick={() =>
                isPro && onUpdate({ callForwardingEnabled: !forwardingEnabled })
              }
              className={[
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                forwardingEnabled && isPro
                  ? "bg-indigo-600"
                  : "bg-muted",
                !isPro ? "cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              aria-checked={forwardingEnabled && isPro}
              role="switch"
            >
              <span
                className={[
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
                  forwardingEnabled && isPro ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Forwarding number — slides in when toggled */}
          <AnimatePresence>
            {forwardingEnabled && isPro && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="emergencyPhone">Forwarding number</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    value={data.emergencyPhone}
                    onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
                    placeholder="(306) 555-1234"
                  />
                  <p className="text-xs text-muted-foreground">
                    Urgent calls will be transferred here.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
