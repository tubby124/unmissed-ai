import test from 'node:test'
import assert from 'node:assert/strict'
import { STEP_DEFS } from '@/app/onboard/config/steps'
import { defaultOnboardingData, type OnboardingData } from '@/types/onboarding'

const businessStep = STEP_DEFS.find((step) => step.label === 'Your business')

function data(overrides: Partial<OnboardingData>): OnboardingData {
  return {
    ...defaultOnboardingData,
    ...overrides,
  }
}

test('manual onboarding cannot continue with a generic other niche and no business context', () => {
  assert.ok(businessStep)

  assert.equal(
    businessStep.canAdvance(data({
      businessName: 'End Voicemail QA Plumbing',
      agentName: 'Alex',
      niche: 'other',
    })),
    false
  )
})

test('manual onboarding can continue when a unique business provides enough description', () => {
  assert.ok(businessStep)

  assert.equal(
    businessStep.canAdvance(data({
      businessName: 'End Voicemail QA Services',
      agentName: 'Alex',
      niche: 'other',
      manualDescription: 'We answer after-hours calls for busy local service businesses.',
    })),
    true
  )
})

test('manual onboarding can continue when a production niche is selected', () => {
  assert.ok(businessStep)

  assert.equal(
    businessStep.canAdvance(data({
      businessName: 'End Voicemail QA Plumbing',
      agentName: 'Alex',
      niche: 'plumbing',
    })),
    true
  )
})
