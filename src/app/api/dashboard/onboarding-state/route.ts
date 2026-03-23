/**
 * PATCH /api/dashboard/onboarding-state
 *
 * Updates the authenticated user's onboarding_state in client_users.
 * Used by the onboarding checklist, tour, and agent test card.
 *
 * Body: { action, stepId? }
 * Actions: complete_step, dismiss_checklist, dismiss_tour, record_first_login, increment_test_calls
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const VALID_STEPS = ['meet_agent', 'setup_alerts', 'train_agent', 'go_live']

const VALID_ACTIONS = [
  'complete_step',
  'dismiss_checklist',
  'dismiss_tour',
  'record_first_login',
  'increment_test_calls',
] as const

type Action = (typeof VALID_ACTIONS)[number]

interface OnboardingState {
  checklist_dismissed: boolean
  tour_completed: boolean
  tour_dismissed: boolean
  steps_completed: string[]
  first_login_at: string | null
  test_call_count: number
}

const DEFAULT_STATE: OnboardingState = {
  checklist_dismissed: false,
  tour_completed: false,
  tour_dismissed: false,
  steps_completed: [],
  first_login_at: null,
  test_call_count: 0,
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { action?: string; stepId?: string }
  const action = body.action as Action | undefined

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  if (action === 'complete_step' && (!body.stepId || !VALID_STEPS.includes(body.stepId))) {
    return NextResponse.json(
      { error: `Invalid stepId. Must be one of: ${VALID_STEPS.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch current onboarding_state
  const svc = createServiceClient()
  const { data: cu, error: cuErr } = await svc
    .from('client_users')
    .select('id, onboarding_state')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cuErr || !cu) {
    return NextResponse.json({ error: 'No client account found' }, { status: 404 })
  }

  const current: OnboardingState = {
    ...DEFAULT_STATE,
    ...(cu.onboarding_state as Partial<OnboardingState> | null),
  }

  // Apply mutation
  switch (action) {
    case 'complete_step': {
      const stepId = body.stepId!
      if (!current.steps_completed.includes(stepId)) {
        current.steps_completed = [...current.steps_completed, stepId]
      }
      break
    }
    case 'dismiss_checklist':
      current.checklist_dismissed = true
      break
    case 'dismiss_tour':
      current.tour_dismissed = true
      current.tour_completed = true
      break
    case 'record_first_login':
      if (!current.first_login_at) {
        current.first_login_at = new Date().toISOString()
      }
      break
    case 'increment_test_calls':
      current.test_call_count += 1
      if (!current.steps_completed.includes('meet_agent')) {
        current.steps_completed = [...current.steps_completed, 'meet_agent']
      }
      break
  }

  // Persist
  const { error: updateErr } = await svc
    .from('client_users')
    .update({ onboarding_state: current })
    .eq('id', cu.id)

  if (updateErr) {
    console.error(`[onboarding] Failed to update state: ${updateErr.message}`)
    return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, state: current })
}

// GET — fetch current onboarding state (used by useOnboarding hook)
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('onboarding_state')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  const state: OnboardingState = {
    ...DEFAULT_STATE,
    ...(cu?.onboarding_state as Partial<OnboardingState> | null),
  }

  return NextResponse.json({ state })
}
