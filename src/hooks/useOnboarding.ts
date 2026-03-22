"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export interface OnboardingState {
  checklist_dismissed: boolean
  tour_completed: boolean
  tour_dismissed: boolean
  steps_completed: string[]
  first_login_at: string | null
  test_call_count: number
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  checklist_dismissed: false,
  tour_completed: false,
  tour_dismissed: false,
  steps_completed: [],
  first_login_at: null,
  test_call_count: 0,
}

async function patchOnboarding(action: string, stepId?: string): Promise<OnboardingState | null> {
  try {
    const res = await fetch("/api/dashboard/onboarding-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, stepId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.state ?? null
  } catch {
    return null
  }
}

export function useOnboarding(initialState?: Partial<OnboardingState>) {
  const [state, setState] = useState<OnboardingState>({
    ...DEFAULT_ONBOARDING_STATE,
    ...initialState,
  })
  const [loading, setLoading] = useState(!initialState)
  const fetchedRef = useRef(false)

  // Fetch state on mount if no initial state provided
  useEffect(() => {
    if (initialState || fetchedRef.current) return
    fetchedRef.current = true

    fetch("/api/dashboard/onboarding-state")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.state) setState({ ...DEFAULT_ONBOARDING_STATE, ...data.state })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [initialState])

  const completeStep = useCallback(async (stepId: string) => {
    // Optimistic update
    setState(prev => ({
      ...prev,
      steps_completed: prev.steps_completed.includes(stepId)
        ? prev.steps_completed
        : [...prev.steps_completed, stepId],
    }))
    const result = await patchOnboarding("complete_step", stepId)
    if (result) setState(result)
  }, [])

  const dismissChecklist = useCallback(async () => {
    setState(prev => ({ ...prev, checklist_dismissed: true }))
    const result = await patchOnboarding("dismiss_checklist")
    if (result) setState(result)
  }, [])

  const dismissTour = useCallback(async () => {
    setState(prev => ({ ...prev, tour_dismissed: true, tour_completed: true }))
    const result = await patchOnboarding("dismiss_tour")
    if (result) setState(result)
  }, [])

  const recordFirstLogin = useCallback(async () => {
    if (state.first_login_at) return // Already recorded
    setState(prev => ({ ...prev, first_login_at: new Date().toISOString() }))
    const result = await patchOnboarding("record_first_login")
    if (result) setState(result)
  }, [state.first_login_at])

  const incrementTestCalls = useCallback(async () => {
    setState(prev => ({
      ...prev,
      test_call_count: prev.test_call_count + 1,
      steps_completed: prev.steps_completed.includes("meet_agent")
        ? prev.steps_completed
        : [...prev.steps_completed, "meet_agent"],
    }))
    const result = await patchOnboarding("increment_test_calls")
    if (result) setState(result)
  }, [])

  const isStepComplete = useCallback(
    (stepId: string) => state.steps_completed.includes(stepId),
    [state.steps_completed]
  )

  return {
    state,
    loading,
    completeStep,
    dismissChecklist,
    dismissTour,
    recordFirstLogin,
    incrementTestCalls,
    isStepComplete,
  }
}
