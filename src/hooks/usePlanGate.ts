'use client'

import { useMemo } from 'react'
import { getPlanEntitlements, type PlanEntitlements, type PlanIdOrTrial } from '@/lib/plan-entitlements'

export type PlanFeature = 'booking' | 'transfer' | 'knowledge' | 'fileUpload' | 'learningLoop' | 'leadScoring' | 'sms'

const FEATURE_TO_PLAN: Record<PlanFeature, 'core' | 'pro'> = {
  booking: 'pro',
  transfer: 'pro',
  knowledge: 'core',
  fileUpload: 'core',
  learningLoop: 'core',
  leadScoring: 'core',
  sms: 'core', // sms is on all plans but keeping for completeness
}

const FEATURE_TO_ENTITLEMENT: Record<PlanFeature, keyof PlanEntitlements> = {
  booking: 'bookingEnabled',
  transfer: 'transferEnabled',
  knowledge: 'knowledgeEnabled',
  fileUpload: 'fileUploadEnabled',
  learningLoop: 'learningLoopEnabled',
  leadScoring: 'leadScoringEnabled',
  sms: 'smsEnabled',
}

interface PlanGateResult {
  /** Whether the feature is locked (not available on current plan) */
  locked: boolean
  /** The minimum plan required to unlock this feature */
  requiredPlan: 'core' | 'pro'
  /** Whether the user is currently on a trial */
  isTrialing: boolean
  /** Full entitlements for the current plan */
  entitlements: PlanEntitlements
  /** The effective plan ID */
  effectivePlanId: PlanIdOrTrial
}

/**
 * Hook to check whether a feature is available on the user's current plan.
 * During trial, all features are unlocked.
 */
export function usePlanGate(
  selectedPlan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  feature: PlanFeature,
): PlanGateResult {
  return useMemo(() => {
    const isTrialing = subscriptionStatus === 'trialing'
    const effectivePlanId: PlanIdOrTrial = isTrialing ? 'trial' : (selectedPlan as PlanIdOrTrial) ?? 'lite'
    const entitlements = getPlanEntitlements(effectivePlanId)
    const entitlementKey = FEATURE_TO_ENTITLEMENT[feature]
    const locked = !entitlements[entitlementKey]
    const requiredPlan = FEATURE_TO_PLAN[feature]

    return { locked, requiredPlan, isTrialing, entitlements, effectivePlanId }
  }, [selectedPlan, subscriptionStatus, feature])
}

/**
 * Non-hook version for use outside React components.
 */
export function checkPlanGate(
  selectedPlan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  feature: PlanFeature,
): PlanGateResult {
  const isTrialing = subscriptionStatus === 'trialing'
  const effectivePlanId: PlanIdOrTrial = isTrialing ? 'trial' : (selectedPlan as PlanIdOrTrial) ?? 'lite'
  const entitlements = getPlanEntitlements(effectivePlanId)
  const entitlementKey = FEATURE_TO_ENTITLEMENT[feature]
  const locked = !entitlements[entitlementKey]
  const requiredPlan = FEATURE_TO_PLAN[feature]

  return { locked, requiredPlan, isTrialing, entitlements, effectivePlanId }
}
