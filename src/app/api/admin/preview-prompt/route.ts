/**
 * POST /api/admin/preview-prompt
 *
 * Admin-only prompt preview. Takes OnboardingData (same shape as the wizard),
 * generates the system prompt, SMS template, classification rules, and variable
 * debug info — all without any side effects.
 *
 * Returns the full generated prompt so admin can verify intake → prompt quality.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { OnboardingData } from '@/types/onboarding'
import { toIntakePayload } from '@/lib/intake-transform'
import {
  buildPromptFromIntake,
  validatePrompt,
  buildSmsTemplate,
  NICHE_CLASSIFICATION_RULES,
  NICHE_DEFAULTS,
} from '@/lib/prompt-builder'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  let data: OnboardingData
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!data.niche) {
    return NextResponse.json({ error: 'niche is required' }, { status: 400 })
  }

  // ── Transform to intake payload ────────────────────────────────────────────
  const intakeSnapshot = toIntakePayload(data)

  // ── Generate prompt ────────────────────────────────────────────────────────
  let prompt: string
  try {
    prompt = buildPromptFromIntake(intakeSnapshot as Record<string, unknown>)
  } catch (err) {
    return NextResponse.json(
      { error: 'Prompt generation failed', detail: String(err) },
      { status: 500 },
    )
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  const validation = validatePrompt(prompt)

  // ── SMS template ───────────────────────────────────────────────────────────
  const smsTemplate = buildSmsTemplate(intakeSnapshot as Record<string, unknown>)

  // ── Classification rules ───────────────────────────────────────────────────
  const niche = (intakeSnapshot.niche as string) || 'other'
  const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other

  // ── Variable debug: intake vs defaults ─────────────────────────────────────
  const nicheDefaults = {
    ...(NICHE_DEFAULTS._common || {}),
    ...(NICHE_DEFAULTS[niche] || {}),
  }
  const fromIntake: Record<string, string> = {}
  const fromDefaults: Record<string, string> = {}
  const merged: Record<string, string> = {}

  // Check each niche default key against what the intake provided
  for (const [key, defaultValue] of Object.entries(nicheDefaults)) {
    const snakeKey = key.toLowerCase()
    const intakeValue = (intakeSnapshot as Record<string, unknown>)[snakeKey]
      ?? (intakeSnapshot as Record<string, unknown>)[`niche_${snakeKey}`]

    if (intakeValue !== undefined && intakeValue !== '' && intakeValue !== defaultValue) {
      fromIntake[key] = String(intakeValue)
      merged[key] = String(intakeValue)
    } else {
      fromDefaults[key] = String(defaultValue)
      merged[key] = String(defaultValue)
    }
  }

  // Also add intake fields that aren't in niche defaults (business_name, agent_name, etc.)
  for (const [key, value] of Object.entries(intakeSnapshot)) {
    if (!(key in merged) && value !== '' && value !== undefined) {
      fromIntake[key] = String(value)
      merged[key] = String(value)
    }
  }

  return NextResponse.json({
    prompt,
    charCount: validation.charCount,
    valid: validation.valid,
    warnings: validation.warnings,
    errors: validation.errors,
    niche,
    intakeSnapshot,
    smsTemplate,
    classificationRules,
    variableDebug: { fromIntake, fromDefaults, merged },
  })
}
