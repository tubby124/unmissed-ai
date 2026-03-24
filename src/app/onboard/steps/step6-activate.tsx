"use client";

import { motion } from "motion/react";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";
import { PLANS } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onActivate: (mode: "trial" | "paid") => void;
  isSubmitting: boolean;
  error: string | null;
}

export default function Step6Activate({ data, onUpdate, onActivate, isSubmitting, error }: Props) {
  const agentName = data.agentName || "your agent";
  const businessName = data.businessName || "your business";
  const planData = PLANS.find((p) => p.id === data.selectedPlan) ?? PLANS[1]; // default Core

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Almost ready.</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Last details to launch {agentName}.
        </p>
      </div>

      {/* Trust chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: "🔒", text: "Secure" },
          { icon: "📅", text: "$0 today" },
          { icon: "✕", text: "Cancel anytime" },
        ].map(({ icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            <span>{icon}</span>
            {text}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {/* Business name — editable, pre-filled */}
        <div className="space-y-1.5">
          <Label htmlFor="businessName">
            Business name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="businessName"
            value={data.businessName}
            onChange={(e) => onUpdate({ businessName: e.target.value })}
            placeholder="Acme Services"
          />
        </div>

        {/* Business phone */}
        <div className="space-y-1.5">
          <Label htmlFor="callbackPhone">
            Business phone <span className="text-red-500">*</span>
          </Label>
          <Input
            id="callbackPhone"
            type="tel"
            value={data.callbackPhone}
            onChange={(e) => onUpdate({ callbackPhone: e.target.value })}
            placeholder="(306) 555-1234"
          />
          <p className="text-xs text-muted-foreground">
            The number callers will be told to call back on.
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">
            Email address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactEmail"
            type="email"
            value={data.contactEmail}
            onChange={(e) => onUpdate({ contactEmail: e.target.value })}
            placeholder="you@business.com"
          />
          <p className="text-xs text-muted-foreground">
            Your dashboard login and where call summaries go.
          </p>
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl">
            Website{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (helps train your agent)
            </span>
          </Label>
          <Input
            id="websiteUrl"
            type="url"
            value={data.websiteUrl}
            onChange={(e) => onUpdate({ websiteUrl: e.target.value })}
            placeholder="https://yourbusiness.com"
          />
        </div>

        {/* Notification method */}
        <div className="space-y-1.5">
          <Label htmlFor="notificationMethod">
            How should we notify you of new calls?
          </Label>
          <select
            id="notificationMethod"
            value={data.notificationMethod || "email"}
            onChange={(e) =>
              onUpdate({ notificationMethod: e.target.value as NotificationMethod })
            }
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
          >
            <option value="email">Email</option>
            <option value="telegram">Telegram</option>
            <option value="sms">SMS text</option>
            <option value="both">Telegram + Email</option>
          </select>
        </div>
      </div>

      {/* Agent summary card */}
      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            Your plan
          </p>
          <span className="text-xs font-bold text-foreground">
            {planData.name} — ${planData.monthly}/mo
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">
          <span className="font-bold">{agentName}</span> will answer calls for{" "}
          <span className="font-bold">{businessName}</span>
        </p>
        <p className="text-xs text-muted-foreground">7-day free trial · No credit card required</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Activate button */}
      <motion.button
        type="button"
        onClick={() => onActivate("trial")}
        disabled={isSubmitting}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Setting up your agent..." : `Launch ${agentName} →`}
      </motion.button>
    </div>
  );
}
