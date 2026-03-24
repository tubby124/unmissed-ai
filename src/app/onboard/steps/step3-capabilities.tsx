"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

function CapabilityRow({
  label,
  description,
  flavorText,
  checked,
  disabled = false,
  onChange,
  badge,
}: {
  label: string;
  description: string;
  flavorText?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        checked
          ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20"
          : "border-border bg-card"
      } ${disabled ? "opacity-75" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
            checked ? "bg-indigo-600 border-indigo-600" : "border-border bg-background"
          } ${disabled ? "cursor-default" : "cursor-pointer"}`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {badge && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <AnimatePresence>
            {checked && flavorText && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 6 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-indigo-700 dark:text-indigo-300 italic border-l-2 border-indigo-300 dark:border-indigo-700 pl-2"
              >
                {flavorText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function Step3Capabilities({ data, onUpdate }: Props) {
  const bookingEnabled = data.callHandlingMode === "full_service";
  const forwardingEnabled = data.callForwardingEnabled ?? false;
  const isPro = data.selectedPlan === "pro";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          What can {data.agentName || "your agent"} do?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Turn on the features you want. You can change these anytime from your dashboard.
        </p>
      </div>

      <div className="space-y-3">
        <CapabilityRow
          label="Answer every call"
          description="Greets callers, collects info, and sends you a summary after each call"
          checked={true}
          disabled={true}
          onChange={() => {}}
        />

        <CapabilityRow
          label="Book appointments"
          description="Let callers schedule directly through your agent"
          flavorText={isPro ? `"I'll book you in for Tuesday at 2pm — does that work for you?"` : undefined}
          checked={bookingEnabled && isPro}
          disabled={!isPro}
          onChange={(checked) => onUpdate({ callHandlingMode: checked ? "full_service" : "triage" })}
          badge={!isPro ? "Pro plan" : undefined}
        />

        <CapabilityRow
          label="FAQ & website knowledge"
          description="Your agent learns from your website and answers questions automatically"
          checked={true}
          disabled={true}
          onChange={() => {}}
        />

        <CapabilityRow
          label="Call forwarding"
          description="Transfer urgent calls to your phone number"
          checked={forwardingEnabled && isPro}
          disabled={!isPro}
          onChange={(checked) => onUpdate({ callForwardingEnabled: checked })}
          badge={!isPro ? "Pro plan" : undefined}
        />
      </div>

      {/* Forwarding number — slides in when enabled */}
      <AnimatePresence>
        {forwardingEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            <Label htmlFor="emergencyPhone">Forwarding number</Label>
            <Input
              id="emergencyPhone"
              type="tel"
              value={data.emergencyPhone}
              onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
              placeholder="(306) 555-1234"
            />
            <p className="text-xs text-muted-foreground">Urgent calls will be transferred here.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
