"use client";

import { motion, AnimatePresence } from "motion/react";
import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CapabilityRow } from "@/components/shared/CapabilityRow";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
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
