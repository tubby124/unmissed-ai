/**
 * D303: Variable Edit API — GET + PATCH /api/dashboard/variables
 *
 * GET — Returns resolved variable values for the authenticated client.
 *   Combines: niche defaults → niche_custom_variables → DB column overrides.
 *   Used by PromptVariablesCard to show current values.
 *
 * PATCH — Allows editing prompt variables post-onboarding. Routes each variable to
 * the correct storage location (DB column or niche_custom_variables JSONB)
 * using the prompt-variable-registry, then regenerates only the affected slots.
 *
 * This is the targeted mutation path — unlike recomposePrompt() (D280) which
 * rebuilds everything, this only touches the slots affected by the changed variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  getVariable,
  getSlotsAffectedByDbField,
  PROMPT_VARIABLE_REGISTRY,
  type PromptVariable,
} from '@/lib/prompt-variable-registry'
import { regenerateSlots } from '@/lib/slot-regenerator'
import { clientRowToIntake } from '@/lib/slot-regenerator'
import { buildSlotContext } from '@/lib/prompt-slots'
import type { SlotId } from '@/lib/prompt-sections'

// ── GET — Resolve current variable values ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  // Admin can fetch variables for any client
  let targetClientId = cu.client_id
  const qsClientId = req.nextUrl.searchParams.get('client_id')
  if (cu.role === 'admin' && qsClientId) {
    targetClientId = qsClientId
  }

  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', targetClientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Get services for intake
  const { data: services } = await svc
    .from('client_services')
    .select('*')
    .eq('client_id', targetClientId)

  // Get knowledge chunk count
  const { count: chunkCount } = await svc
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', targetClientId)
    .eq('status', 'approved')

  const intake = clientRowToIntake(client, services ?? [], chunkCount ?? 0)
  const ctx = buildSlotContext(intake)

  // Build resolved values from the context's variables map
  const resolvedVars: Record<string, { value: string; meta: PromptVariable }> = {}

  for (const varDef of PROMPT_VARIABLE_REGISTRY) {
    const value = ctx.variables[varDef.key] ?? ''
    resolvedVars[varDef.key] = { value, meta: varDef }
  }

  return NextResponse.json({ variables: resolvedVars })
}

export async function PATCH(req: NextRequest) {
  // 1 — Auth
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  // 2 — Parse body
  const body = await req.json().catch(() => null)
  if (!body || typeof body.variableKey !== 'string' || typeof body.value !== 'string') {
    return NextResponse.json({ error: 'Required: { variableKey: string, value: string }' }, { status: 400 })
  }

  const { variableKey, value } = body as { variableKey: string; value: string }
  const trimmedValue = value.trim()

  // Admin can edit variables for any client
  let clientId = cu.client_id
  if (cu.role === 'admin' && typeof body.client_id === 'string') {
    clientId = body.client_id
  }

  // 3 — Look up variable in registry
  const varDef = getVariable(variableKey)
  if (!varDef) {
    return NextResponse.json({ error: `Unknown variable: ${variableKey}` }, { status: 400 })
  }

  // 4 — Write to correct storage location
  const svc = createServiceClient()
  let affectedSlots: SlotId[] = []

  if (varDef.dbField) {
    // Variable maps to a dedicated DB column — write directly
    const { error: updateErr } = await svc
      .from('clients')
      .update({
        [varDef.dbField]: trimmedValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 })
    }

    // Get all slots affected by this DB field change
    affectedSlots = getSlotsAffectedByDbField(varDef.dbField)
  } else {
    // Variable lives in niche_custom_variables JSONB — merge in
    const { data: client } = await svc
      .from('clients')
      .select('niche_custom_variables')
      .eq('id', clientId)
      .single()

    const currentNcv = (client?.niche_custom_variables as Record<string, unknown>) ?? {}
    const updatedNcv = { ...currentNcv, [variableKey]: trimmedValue }

    const { error: updateErr } = await svc
      .from('clients')
      .update({
        niche_custom_variables: updatedNcv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 })
    }

    // The variable's owning slot needs regeneration
    affectedSlots = [varDef.slotId]
  }

  // 5 — Regenerate affected slots
  if (affectedSlots.length === 0) {
    affectedSlots = [varDef.slotId]
  }

  // Include prompt diff data if requested (for frontend diff display)
  const includeDiff = body.includeDiff === true

  const result = await regenerateSlots(clientId, affectedSlots, user.id)

  if (!result.success) {
    // DB was updated but regeneration failed (e.g., old-format prompt)
    // Return partial success — the value is saved, prompt just wasn't updated
    return NextResponse.json({
      ok: true,
      warning: result.error,
      affectedSlots,
      charCount: result.charCount,
      promptRegenerated: false,
    })
  }

  // If diff requested: read back the current prompt for comparison
  // (regenerateSlots already saved the new prompt to DB)
  let newPrompt: string | undefined
  if (includeDiff && result.promptChanged) {
    const { data: updatedClient } = await svc
      .from('clients')
      .select('system_prompt')
      .eq('id', clientId)
      .single()
    newPrompt = updatedClient?.system_prompt as string | undefined
  }

  return NextResponse.json({
    ok: true,
    affectedSlots,
    charCount: result.charCount,
    promptChanged: result.promptChanged,
    ...(newPrompt ? { newPrompt } : {}),
  })
}
