"use client";

import { motion } from "motion/react";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";
import { PLANS } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WebsiteScrapePreview from "@/components/onboard/WebsiteScrapePreview";
import { getAgentMode } from "@/lib/capabilities";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onActivate: (mode: "trial" | "paid") => void;
  isSubmitting: boolean;
  error: string | null;
}

function KnowledgeSummary({ data, agentName }: { data: OnboardingData; agentName: string }) {
  const mode = data.callHandlingMode ?? 'triage'
  const modeConfig = getAgentMode(mode)

  // Count knowledge items
  const faqCount = (data.faqPairs || []).filter(p => p.question?.trim() && p.answer?.trim()).length
  const scrapeResult = data.websiteScrapeResult
  const scrapedFactCount = scrapeResult
    ? scrapeResult.businessFacts.filter((_: string, i: number) => scrapeResult.approvedFacts?.[i] !== false).length
    : 0
  const scrapedQaCount = scrapeResult
    ? scrapeResult.extraQa.filter((_: { q: string; a: string }, i: number) => scrapeResult.approvedQa?.[i] !== false).length
    : 0
  const hasHours = !!(data.businessHoursText?.trim())
  const hasWebsite = !!(data.websiteUrl?.trim())
  const totalKnowledge = faqCount + scrapedFactCount + scrapedQaCount

  // Capability status
  const caps = [
    { label: 'Call summaries', on: true },
    { label: 'SMS follow-up', on: data.callerAutoText !== false },
    { label: 'Website knowledge', on: hasWebsite },
    { label: 'Calendar booking', on: mode === 'full_service' },
    { label: 'Call forwarding', on: !!(data.callForwardingEnabled && data.emergencyPhone?.trim()) },
    { label: 'IVR pre-filter', on: data.ivrEnabled === true },
  ]
  const activeCaps = caps.filter(c => c.on)

  return (
    <div className="rounded-xl border b-theme bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.12em] uppercase t3">
          What {agentName} will know
        </p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          {modeConfig.icon} {modeConfig.label}
        </span>
      </div>

      {/* Knowledge counts */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{totalKnowledge}</p>
          <p className="text-[10px] t3">{totalKnowledge === 1 ? 'fact' : 'facts'}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{faqCount}</p>
          <p className="text-[10px] t3">{faqCount === 1 ? 'FAQ' : 'FAQs'}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{hasHours ? 'Set' : '--'}</p>
          <p className="text-[10px] t3">hours</p>
        </div>
      </div>

      {/* Active capabilities */}
      <div className="flex flex-wrap gap-1.5">
        {activeCaps.map(c => (
          <span key={c.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[11px] text-emerald-700 dark:text-emerald-300">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            {c.label}
          </span>
        ))}
      </div>

      <p className="text-xs t3">
        You can teach {agentName} more from your dashboard after launch.
      </p>
    </div>
  )
}

export default function Step6Activate({ data, onUpdate, onActivate, isSubmitting, error }: Props) {
  const agentName = data.agentName || "your agent";
  const businessName = data.businessName || "your business";
  const planData = PLANS.find((p) => p.id === data.selectedPlan) ?? PLANS[1]; // default Core
  const modeConfig = getAgentMode(data.callHandlingMode ?? 'triage')

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

        {/* Website scrape preview — auto-fires when websiteUrl is set */}
        <WebsiteScrapePreview data={data} onUpdate={onUpdate} />

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

      {/* ── Pre-activation knowledge summary ─────────────────────────── */}
      <KnowledgeSummary data={data} agentName={agentName} />

      {/* GBP data summary — show what was learned from Google Maps */}
      {(data.gbpDescription || data.placesRating || data.businessHoursText) && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            What we learned from Google Maps
          </p>
          {data.gbpDescription && (
            <p className="text-sm text-foreground italic leading-snug">&ldquo;{data.gbpDescription}&rdquo;</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.placesRating && (
              <span>{data.placesRating} rating{data.placesReviewCount ? ` (${data.placesReviewCount} reviews)` : ''}</span>
            )}
            {data.businessHoursText && (
              <span>{data.businessHoursText}</span>
            )}
            {data.callbackPhone && (
              <span>{data.callbackPhone}</span>
            )}
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            Your agent will know this — you can edit it any time from your dashboard.
          </p>
        </div>
      )}

      {/* Agent summary card */}
      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4 space-y-3">
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
            {modeConfig.icon} {modeConfig.label}
          </span>
        </div>
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
