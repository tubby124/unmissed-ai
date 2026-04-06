/**
 * Onboarding Step Registry
 *
 * Single source of truth for all onboarding steps.
 *
 * HOW TO MODIFY THE FLOW:
 * ─────────────────────────────────────────────────────────────────
 * Add a step:      Import your component, add an entry to STEP_DEFS.
 * Remove a step:   Comment out or delete the entry.
 * Reorder steps:   Move entries up/down in the array.
 * Rename a step:   Change the `label` string.
 * Change gating:   Update the `canAdvance` function for that entry.
 * Custom CTA:      Set `hideFooterCta: true` (hides the shared Continue button;
 *                  the step renders its own primary action button).
 *
 * ADDING SPECIAL PROPS (like onActivate, isSubmitting):
 *   The page passes a `ctx` object to every step.  If your step needs
 *   extra props from the page, add them to PageContext and forward them
 *   in `extraProps` below.  See the Launch step for an example.
 * ─────────────────────────────────────────────────────────────────
 */

import type { ComponentType } from 'react'
import type { OnboardingData } from '@/types/onboarding'

// ── Types ──────────────────────────────────────────────────────────────────

/** Props every step component must accept */
export interface BaseStepProps {
  data: OnboardingData
  onUpdate: (updates: Partial<OnboardingData>) => void
}

/** Extra context the page injects into the last (activation) step */
export interface ActivationContext {
  onActivate: (mode: 'trial' | 'paid') => void
  isSubmitting: boolean
  error: string | null
  canActivate: boolean
}

export interface StepDef {
  /** Label shown in "Step N of M — {label}" and the segmented progress bar */
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  /** Return true when the user can proceed to the next step */
  canAdvance: (data: OnboardingData) => boolean
  /**
   * When true, the shared "Continue →" footer button is hidden.
   * Use for the last step or any step that renders its own primary CTA.
   */
  hideFooterCta?: boolean
  /**
   * Extra props to merge in at render time. Resolved against ActivationContext
   * passed from page.tsx. Only needed for the activation step.
   */
  activationProps?: true
}

// ── Step Registry ──────────────────────────────────────────────────────────
//
// Import step components here. Add/remove/reorder entries to change the flow.

import Step1GBP from '../steps/step1-gbp'
import StepNiche from '../steps/step-niche'
import StepPlan from '../steps/step-plan'
import Step6Activate from '../steps/step6-activate'

/**
 * 4-step onboarding — Your business → Your agent → Your plan → Launch
 * StepNiche (D386) re-wired 2026-04-04 after Phase 7 removed it.
 */
export const STEP_DEFS: StepDef[] = [
  {
    label: 'Your business',
    component: Step1GBP,
    canAdvance: (d) => !!d.businessName && !!d.agentName?.trim(),
  },
  {
    label: 'Your agent',
    component: StepNiche,
    canAdvance: (data: OnboardingData) => {
      if (!data.voiceId) return false;
      const nichesWithServices: string[] = ['auto_glass', 'plumbing', 'hvac', 'dental', 'legal', 'salon'];
      if (nichesWithServices.includes(data.niche || '')) {
        const services = data.nicheAnswers?.services;
        return Array.isArray(services) && (services as string[]).length > 0;
      }
      // PM requires manager name (CLOSE_PERSON) and after-hours behavior (emergency routing choice)
      if (data.niche === 'property_management') {
        return !!data.ownerName?.trim() && !!(data.nicheAnswers?.afterHoursBehavior as string | undefined);
      }
      return true;
    },
  },
  {
    label: 'Your plan',
    component: StepPlan,
    canAdvance: (d) => !!d.selectedPlan,
  },
  {
    label: 'Launch',
    component: Step6Activate,
    canAdvance: (d) => {
      if (!d.businessName?.trim() || !d.contactEmail?.trim() || !d.callbackPhone?.trim()) return false;
      if (d.notificationMethod === 'sms' && !d.notificationPhone?.trim()) return false;
      return true;
    },
    hideFooterCta: true,
    activationProps: true,
  },
]

// Derived helpers (avoids recalculating in page.tsx)
export const TOTAL_STEPS = STEP_DEFS.length
