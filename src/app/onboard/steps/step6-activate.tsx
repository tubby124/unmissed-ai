"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";
import { PLANS } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAgentMode } from "@/lib/capabilities";
import { Shield, CalendarOff, X, Check, Rocket, Brain, ChevronDown, Phone } from "lucide-react";
import { normalize24hHours } from "@/lib/prompt-slots";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
  onActivate: (mode: "trial" | "paid") => void;
  isSubmitting: boolean;
  error: string | null;
  canActivate: boolean;
}

// Niche fallback greetings — shown if intelligence API hasn't returned yet
const NICHE_FALLBACK_GREETING: Record<string, string> = {
  hvac: "Thank you for calling, this is {name}! Are you looking to book a service call, or can I help with something else?",
  plumbing: "Thanks for calling, this is {name}! Got a plumbing issue I can help with?",
  auto_glass: "Hey thanks for calling, this is {name}! Calling about a chip or crack in your glass?",
  dental: "Thank you for calling, this is {name}! Are you looking to book an appointment?",
  restaurant: "Thanks for calling, this is {name}! Can I help you with a reservation or question?",
  salon: "Hey, thanks for calling! This is {name} — looking to book an appointment?",
  legal: "Thank you for calling, this is {name}. How can I direct your call today?",
  real_estate: "Thanks for calling, this is {name}! Are you looking to buy, sell, or just have a question?",
  property_management: "Thank you for calling, this is {name}. Is this a maintenance request or can I help with something else?",
  other: "Thank you for calling, this is {name}! How can I help you today?",
};

function getFallbackGreeting(niche: string, agentName: string): string {
  const template = NICHE_FALLBACK_GREETING[niche] ?? NICHE_FALLBACK_GREETING.other;
  return template.replace('{name}', agentName);
}

// ── D389 — Aha Moment: hear your agent before going live ──────────────────────
function AhaMomentPanel({ data, agentName, businessName }: { data: OnboardingData; agentName: string; businessName: string }) {
  const [timedOut, setTimedOut] = useState(false);

  // Prefer AI-generated greeting when available; voicemail fallback only when no intelligence seed exists.
  const isVoicemailNiche = data.niche === 'voicemail';
  const voicemailFallbackGreeting = isVoicemailNiche
    ? `Hey there! This is ${agentName} from ${businessName}... how can I help ya?`
    : null;

  const greeting = data.agentIntelligenceSeed?.GREETING_LINE
    || data.nicheCustomVariables?.GREETING_LINE
    || voicemailFallbackGreeting;

  const isGenerating = !greeting && !!(data.businessName && data.niche) && !timedOut;

  // Fallback after 6s so the panel never hangs indefinitely
  useState(() => {
    if (!greeting && data.businessName && data.niche) {
      const t = setTimeout(() => setTimedOut(true), 6000);
      return () => clearTimeout(t);
    }
  });

  const displayGreeting = greeting || (timedOut ? getFallbackGreeting(data.niche || 'other', agentName) : null);

  if (isGenerating) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          Generating your agent&apos;s greeting...
        </div>
      </div>
    );
  }
  if (!displayGreeting) return null;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
          This is how {agentName} answers calls for {businessName}
        </p>
      </div>
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {agentName[0]}
        </div>
        <div className="flex-1 bg-white dark:bg-card rounded-xl rounded-tl-none px-4 py-3 shadow-sm border border-emerald-100 dark:border-emerald-800/40">
          <p className="text-sm text-foreground leading-relaxed italic">&ldquo;{displayGreeting}&rdquo;</p>
        </div>
      </div>
      <p className="text-[11px] text-emerald-600 dark:text-emerald-500 pl-11">
        AI-generated from your business info. You can refine it from your dashboard.
      </p>
    </div>
  );
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

      {/* Knowledge counts — hide bare zeros when no knowledge yet (scrape fires at provision time) */}
      {factsCount === 0 && qaCount === 0 ? (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
          <p className="text-xs text-muted-foreground">
            {hasWebsite
              ? 'Will learn from your website after launch'
              : 'Teach your agent more from your dashboard after launch'}
          </p>
        </div>
      ) : (
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
      )}

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

function AgentIntelligenceCard({ data, agentName }: { data: OnboardingData; agentName: string }) {
  const [expanded, setExpanded] = useState(false)
  const seed = data.agentIntelligenceSeed

  if (!seed?.TRIAGE_DEEP) return null

  // Parse intent buckets from TRIAGE_DEEP for display
  const intentBlocks = seed.TRIAGE_DEEP
    .split(/\n\n+/)
    .filter(block => block.trim() && !block.startsWith('SPAM'))
    .slice(0, 5)

  const urgencyKeywords = seed.URGENCY_KEYWORDS
    ? seed.URGENCY_KEYWORDS.split(',').map(k => k.trim()).filter(Boolean).slice(0, 6)
    : []

  const neverRules = seed.FORBIDDEN_EXTRA
    ? seed.FORBIDDEN_EXTRA.split('\n').filter(l => l.trim()).slice(0, 4)
    : []

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-violet-700 dark:text-violet-300">
            Agent Intelligence
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
          AI-configured
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {agentName} knows how to handle {intentBlocks.length} caller intent{intentBlocks.length !== 1 ? 's' : ''}, detects urgency, and follows business-specific rules.
      </p>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-violet-100/60 dark:bg-violet-900/30">
          <p className="text-lg font-bold text-foreground">{intentBlocks.length}</p>
          <p className="text-[10px] text-muted-foreground">intents</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-violet-100/60 dark:bg-violet-900/30">
          <p className="text-lg font-bold text-foreground">{urgencyKeywords.length}</p>
          <p className="text-[10px] text-muted-foreground">urgency triggers</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-violet-100/60 dark:bg-violet-900/30">
          <p className="text-lg font-bold text-foreground">{neverRules.length}</p>
          <p className="text-[10px] text-muted-foreground">safety rules</p>
        </div>
      </div>

      {/* Expandable detail */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors cursor-pointer"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Hide details' : 'See what your agent will do'}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-violet-200 dark:border-violet-800/50">
          {/* Greeting */}
          {seed.GREETING_LINE && (
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Opening line</p>
              <p className="text-xs text-foreground italic">&ldquo;{seed.GREETING_LINE}&rdquo;</p>
            </div>
          )}

          {/* Intent buckets */}
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Caller routing</p>
            <div className="space-y-1.5">
              {intentBlocks.map((block, i) => {
                const firstLine = block.split('\n')[0].trim()
                const intentName = firstLine.replace(/:$/, '').replace(/_/g, ' ')
                return (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/60 dark:bg-card/60">
                    <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-foreground">{intentName}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Urgency */}
          {urgencyKeywords.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Urgency triggers</p>
              <div className="flex flex-wrap gap-1">
                {urgencyKeywords.map(k => (
                  <span key={k} className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-[10px] text-red-700 dark:text-red-300">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* NEVER rules */}
          {neverRules.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Safety rules</p>
              <div className="space-y-1">
                {neverRules.map((rule, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">{rule}</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground italic">
            All of this was auto-generated from your Google listing and business type. You can refine it from your dashboard after launch.
          </p>
        </div>
      )}
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

      {/* ── D389 — Aha Moment: hear how your agent sounds before going live ── */}
      <AhaMomentPanel data={data} agentName={agentName} businessName={businessName} />

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
            How should we notify you of new leads? <span className="text-red-500">*</span>
          </Label>
          <select
            id="notificationMethod"
            value={data.notificationMethod || "email"}
            onChange={(e) =>
              onUpdate({ notificationMethod: e.target.value as NotificationMethod })
            }
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
          >
            <option value="email">Email (instant — recommended)</option>
            <option value="sms">SMS text</option>
            <option value="telegram">Telegram</option>
            <option value="both">Telegram + Email</option>
          </select>

          {/* SMS: require phone number */}
          {['sms'].includes(data.notificationMethod || '') && (
            <div className="space-y-1.5 mt-2">
              <Label htmlFor="notificationPhone">Mobile number for SMS alerts <span className="text-red-500">*</span></Label>
              <Input
                id="notificationPhone"
                type="tel"
                value={data.notificationPhone || ''}
                onChange={(e) => onUpdate({ notificationPhone: e.target.value })}
                placeholder="(306) 555-1234"
              />
            </div>
          )}

          {/* Telegram: show connect instructions inline */}
          {['telegram', 'both'].includes(data.notificationMethod || '') && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 px-3 py-2.5 mt-1 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Connect Telegram in 30 seconds</p>
              <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside leading-snug">
                <li>Open Telegram → search <strong>@unmissedai_bot</strong></li>
                <li>Send <strong>/start</strong></li>
                <li>Connect from Settings after you launch</li>
              </ol>
              <p className="text-[11px] text-blue-500 dark:text-blue-400">
                You&apos;ll still get email notifications until Telegram is connected.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Pre-activation knowledge summary ─────────────────────────── */}
      <KnowledgeSummary data={data} agentName={agentName} />

      {/* ── Agent Intelligence — auto-generated from GBP + niche ──────── */}
      <AgentIntelligenceCard data={data} agentName={agentName} />

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
              <span>{normalize24hHours(data.businessHoursText)}</span>
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
