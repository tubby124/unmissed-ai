"use client";

import { motion } from "motion/react";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";
import { PLANS } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAgentMode } from "@/lib/capabilities";
import { Shield, CalendarOff, X, Check, Rocket } from "lucide-react";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onActivate: (mode: "trial" | "paid") => void;
  isSubmitting: boolean;
  error: string | null;
  canActivate: boolean;
}

function KnowledgeSummary({ data, agentName }: { data: OnboardingData; agentName: string }) {
  const mode = data.callHandlingMode ?? 'triage'
  const modeConfig = getAgentMode(mode)

  // Count knowledge items
  const scrapeResult = data.websiteScrapeResult
  const scrapedFactCount = scrapeResult
    ? scrapeResult.businessFacts.filter((_: string, i: number) => scrapeResult.approvedFacts?.[i] !== false).length
    : 0
  const scrapedQaCount = scrapeResult
    ? scrapeResult.extraQa.filter((_: { q: string; a: string }, i: number) => scrapeResult.approvedQa?.[i] !== false).length
    : 0
  const gbpFactCount = data.gbpDescription ? 1 : 0
  const nicheContextCount = Object.values(data.nicheAnswers || {}).filter(v => {
    if (!v) return false
    if (Array.isArray(v)) return (v as string[]).length > 0
    if (typeof v === 'boolean') return v
    return String(v).trim().length > 0
  }).length
  // Non-Q&A factual knowledge (scraped facts + GBP description + niche-specific context)
  const factsCount = scrapedFactCount + gbpFactCount + nicheContextCount
  // All Q&A pairs (manual FAQs + scraped Q&A)
  const qaCount = (data.faqPairs || []).filter(p => p.question?.trim() && p.answer?.trim()).length + scrapedQaCount
  const hasHours = !!(data.businessHoursText?.trim())
  const hasWebsite = !!(data.websiteUrl?.trim())
  const totalKnowledge = factsCount + qaCount

  // Calendar booking is active when mode is full_service OR agent picked the booking mode
  const bookingActive = mode === 'full_service' || data.agentMode === 'appointment_booking'
  // Warn when booking is expected but the selected plan won't include it after trial
  const bookingPlanMismatch = bookingActive && !!data.selectedPlan && data.selectedPlan !== 'pro'

  // Capability status
  const caps = [
    { label: 'Call summaries', on: true },
    { label: 'SMS follow-up', on: data.callerAutoText !== false },
    { label: 'Website knowledge', on: hasWebsite },
    { label: 'Calendar booking', on: bookingActive },
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
          {modeConfig.label}
        </span>
      </div>

      {/* Knowledge counts */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{factsCount}</p>
          <p className="text-[10px] t3">{factsCount === 1 ? 'fact' : 'facts'}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-lg font-bold text-foreground">{qaCount}</p>
          <p className="text-[10px] t3">{qaCount === 1 ? 'Q&A' : 'Q&As'}</p>
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
            <Check className="w-3 h-3" />
            {c.label}
          </span>
        ))}
      </div>

      {/* Plan mismatch warning — booking mode selected but plan won't include it post-trial */}
      {bookingPlanMismatch && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2">
          <span className="text-amber-500 text-sm shrink-0">⚡</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
            Calendar booking is active during your 7-day trial. After trial, it requires <strong>Pro plan</strong> — your current selection won&apos;t include it.
          </p>
        </div>
      )}

      <p className="text-xs t3">
        You can teach {agentName} more from your dashboard after launch.
      </p>
    </div>
  )
}

export default function Step6Activate({ data, onUpdate, onActivate, isSubmitting, error, canActivate }: Props) {
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
          { icon: <Shield className="w-3.5 h-3.5" />, text: "Secure" },
          { icon: <CalendarOff className="w-3.5 h-3.5" />, text: "$0 today" },
          { icon: <X className="w-3.5 h-3.5" />, text: "Cancel anytime" },
        ].map(({ icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            {icon}
            {text}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {/* Email — dashboard login */}
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

        {/* Website — optional, helps train agent */}
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
            {modeConfig.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">7-day free trial · No credit card required</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Required fields hint — only shown when Launch button is blocked */}
      {!canActivate && !isSubmitting && (
        <p className="text-xs text-center text-muted-foreground">
          Fill in business name, phone, and email above to launch.
        </p>
      )}

      {/* Activate button */}
      <motion.button
        type="button"
        onClick={() => onActivate("trial")}
        disabled={isSubmitting || !canActivate}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: canActivate ? 1.01 : 1 }}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 transition-shadow cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Setting up your agent...
          </>
        ) : (
          <>
            <Rocket className="w-4 h-4" />
            Launch {agentName}
          </>
        )}
      </motion.button>
    </div>
  );
}
