/**
 * plan-entitlements.ts — Canonical plan entitlements for unmissed.ai
 *
 * SINGLE SOURCE OF TRUTH for what each plan includes.
 * Consumed by: activate-client, stripe webhook, runtime gating, dashboard.
 *
 * Plan pricing lives in pricing.ts (customer-facing).
 * This file defines the operational entitlements (minutes, capabilities, source limits).
 */

import { PLANS, TRIAL } from '@/lib/pricing'

// ── Plan IDs ────────────────────────────────────────────────────────
export type PlanId = 'lite' | 'core' | 'pro'
export type PlanIdOrTrial = PlanId | 'trial'

// ── Entitlements ────────────────────────────────────────────────────
export interface PlanEntitlements {
  /** Plan display name */
  name: string
  /** Included minutes per billing cycle */
  minutes: number
  /** Booking / calendar integration */
  bookingEnabled: boolean
  /** Live call transfer to owner */
  transferEnabled: boolean
  /** SMS follow-up / auto-text */
  smsEnabled: boolean
  /** Website + GBP knowledge ingestion */
  knowledgeEnabled: boolean
  /** The Learning Loop (weekly AI review) */
  learningLoopEnabled: boolean
  /** Lead scoring (HOT / WARM / COLD) */
  leadScoringEnabled: boolean
  /** Max knowledge sources (websites, GBP, files) */
  maxKnowledgeSources: number
  /** D85 — Max website URLs for scraping (separate from PDF/doc limit) */
  maxWebsiteUrls: number
  /** File upload for knowledge */
  fileUploadEnabled: boolean
  /** D86 — Max PDF/doc uploads (separate from website URL limit) */
  maxKnowledgeDocs: number
}

// ── Per-plan entitlements ───────────────────────────────────────────

const LITE: PlanEntitlements = {
  name: 'Lite',
  minutes: 100,
  bookingEnabled: false,
  transferEnabled: false,
  smsEnabled: true,
  knowledgeEnabled: false,
  learningLoopEnabled: false,
  leadScoringEnabled: false,
  maxKnowledgeSources: 1, // 1 website + GBP + manual facts
  maxWebsiteUrls: 1,
  fileUploadEnabled: false,
  maxKnowledgeDocs: 1,
}

const CORE: PlanEntitlements = {
  name: 'Core',
  minutes: 400,
  bookingEnabled: false,
  transferEnabled: false,
  smsEnabled: true,
  knowledgeEnabled: true,
  learningLoopEnabled: true,
  leadScoringEnabled: true,
  maxKnowledgeSources: 3,
  maxWebsiteUrls: 3,
  fileUploadEnabled: true,
  maxKnowledgeDocs: 5,
}

const PRO: PlanEntitlements = {
  name: 'Pro',
  minutes: 1000,
  bookingEnabled: true,
  transferEnabled: true,
  smsEnabled: true,
  knowledgeEnabled: true,
  learningLoopEnabled: true,
  leadScoringEnabled: true,
  maxKnowledgeSources: 10,
  maxWebsiteUrls: 10,
  fileUploadEnabled: true,
  maxKnowledgeDocs: 20,
}

/** Trial entitlements — all features unlocked for evaluation */
const TRIAL_ENTITLEMENTS: PlanEntitlements = {
  name: 'Trial',
  minutes: TRIAL.minutes, // 50
  bookingEnabled: true,
  transferEnabled: true,
  smsEnabled: true,
  knowledgeEnabled: true,
  learningLoopEnabled: true,
  leadScoringEnabled: true,
  maxKnowledgeSources: 3,
  maxWebsiteUrls: 3,
  fileUploadEnabled: true,
  maxKnowledgeDocs: 5,
}

export const PLAN_ENTITLEMENTS: Record<PlanIdOrTrial, PlanEntitlements> = {
  lite: LITE,
  core: CORE,
  pro: PRO,
  trial: TRIAL_ENTITLEMENTS,
}

// ── Lookup helpers ──────────────────────────────────────────────────

/**
 * Returns the full entitlements for a plan.
 * Falls back to Lite for unknown plan IDs.
 */
export function getPlanEntitlements(planId: string | null | undefined): PlanEntitlements {
  if (!planId) return TRIAL_ENTITLEMENTS
  return PLAN_ENTITLEMENTS[planId as PlanIdOrTrial] ?? LITE
}

/**
 * Returns the included minute limit for a plan.
 * This is the primary replacement for getNicheMinuteLimit().
 */
export function getPlanMinuteLimit(planId: string | null | undefined): number {
  return getPlanEntitlements(planId).minutes
}

/**
 * Returns the effective minute limit, preferring plan-based over niche-based.
 *
 * Priority:
 * 1. Trial status → 50 minutes (regardless of selected_plan — that's their *future* plan)
 * 2. selected_plan from DB → plan entitlements (for active subscribers)
 * 3. Niche fallback (legacy — for clients without selected_plan)
 *
 * This is the drop-in replacement for getNicheMinuteLimit() in activation/webhook code.
 */
export function getEffectiveMinuteLimit(
  selectedPlan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  niche: string | null | undefined,
): number {
  // Trial FIRST: 50 minutes regardless of selected_plan (that's their future plan, not current)
  if (subscriptionStatus === 'trialing') {
    return TRIAL.minutes
  }

  // Plan-based: canonical path for active subscribers
  if (selectedPlan && PLAN_ENTITLEMENTS[selectedPlan as PlanIdOrTrial]) {
    return PLAN_ENTITLEMENTS[selectedPlan as PlanIdOrTrial].minutes
  }

  // Legacy niche fallback — voicemail niche gets 50, everything else gets Lite default
  if (niche === 'voicemail') return 50
  return LITE.minutes
}

/**
 * Resolves the effective plan ID from DB fields.
 * Useful when you need the plan ID rather than just the entitlements.
 */
export function resolveEffectivePlanId(
  selectedPlan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
): PlanIdOrTrial {
  if (selectedPlan && PLAN_ENTITLEMENTS[selectedPlan as PlanIdOrTrial]) {
    return selectedPlan as PlanIdOrTrial
  }
  if (subscriptionStatus === 'trialing') return 'trial'
  return 'lite' // safest default for unknown/legacy clients
}

// ── Add-on scaffolding ──────────────────────────────────────────────

export type AddOnId = 'messaging_pack' | 'live_handoff_pack' | 'minute_reload_50' | 'minute_reload_200'

export interface AddOnDefinition {
  id: AddOnId
  name: string
  monthlyPrice: number
  /** Which plans can purchase this add-on */
  eligiblePlans: PlanId[]
  description: string
}

export const ADD_ONS: AddOnDefinition[] = [
  {
    id: 'messaging_pack',
    name: 'Messaging Pack',
    monthlyPrice: 19,
    eligiblePlans: ['lite', 'core', 'pro'],
    description: 'SMS follow-up and auto-text for every call',
  },
  {
    id: 'live_handoff_pack',
    name: 'Live Handoff Pack',
    monthlyPrice: 39,
    eligiblePlans: ['core'], // Pro includes handoff by default
    description: 'Live call transfer for Core plan users',
  },
  {
    id: 'minute_reload_50',
    name: '50 Extra Minutes',
    monthlyPrice: 10,
    eligiblePlans: ['lite', 'core', 'pro'],
    description: '50 additional minutes ($0.20/min)',
  },
  {
    id: 'minute_reload_200',
    name: '200 Extra Minutes',
    monthlyPrice: 30,
    eligiblePlans: ['lite', 'core', 'pro'],
    description: '200 additional minutes ($0.15/min)',
  },
]

/**
 * Returns whether a specific add-on is available for a given plan.
 */
export function isAddOnEligible(planId: string | null | undefined, addOnId: AddOnId): boolean {
  if (!planId) return false
  const addOn = ADD_ONS.find(a => a.id === addOnId)
  if (!addOn) return false
  return addOn.eligiblePlans.includes(planId as PlanId)
}

// ── Founding promo helpers ──────────────────────────────────────────

/**
 * Returns whether the founding rate applies to a client.
 * Currently: check if effective_monthly_rate matches founding price.
 * Future: will use a dedicated `founding_rate` boolean column.
 */
export function isFoundingCustomer(
  effectiveMonthlyRate: number | null | undefined,
): boolean {
  if (!effectiveMonthlyRate) return false
  // Founding rate = $29/mo for Lite
  return effectiveMonthlyRate === 29
}

/**
 * Returns the founding monthly price for a plan, if applicable.
 * Only Lite has a founding rate ($29 vs standard $49).
 */
export function getFoundingPrice(planId: string): number | null {
  const plan = PLANS.find(p => p.id === planId)
  if (!plan) return null
  return plan.foundingMonthly ?? null
}

// ── Plan comparison helpers (for upgrade CTAs) ──────────────────────

/**
 * Returns the next tier upgrade from the current plan.
 * Returns null if already on Pro or invalid plan.
 */
export function getUpgradePlan(currentPlanId: string | null | undefined): typeof PLANS[number] | null {
  if (!currentPlanId || currentPlanId === 'pro') return null
  if (currentPlanId === 'lite') return PLANS[1] // Core
  if (currentPlanId === 'core') return PLANS[2] // Pro
  if (currentPlanId === 'trial') return PLANS[1] // Core (recommended)
  return null
}
