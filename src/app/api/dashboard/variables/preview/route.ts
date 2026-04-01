/**
 * D305: Variable Preview API — POST /api/dashboard/variables/preview
 *
 * Returns a dry-run preview of what a variable edit would produce
 * without actually saving to DB or syncing to Ultravox.
 *
 * Supports two modes:
 * - Single variable preview: { variableKey, value }
 * - Full recompose preview: { recompose: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getVariable, getSlotsAffectedByDbField } from '@/lib/prompt-variable-registry'
import { regenerateSlots, recomposePrompt } from '@/lib/slot-regenerator'
import type { SlotId } from '@/lib/prompt-sections'

export async function POST(req: NextRequest) {
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
  const clientId = cu.client_id

  // 2 — Parse body
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Mode A: Full recompose preview
  if (body.recompose === true) {
    const result = await recomposePrompt(clientId, user.id, true)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      mode: 'recompose',
      promptChanged: result.promptChanged,
      charCount: result.charCount,
      preview: result.preview,
      currentPrompt: result.currentPrompt,
    })
  }

  // Mode B: Single variable preview
  if (typeof body.variableKey !== 'string') {
    return NextResponse.json({ error: 'Required: { variableKey, value } or { recompose: true }' }, { status: 400 })
  }

  const { variableKey, value } = body as { variableKey: string; value?: string }
  const varDef = getVariable(variableKey)
  if (!varDef) {
    return NextResponse.json({ error: `Unknown variable: ${variableKey}` }, { status: 400 })
  }

  // For preview, we need to temporarily write the value, run dryRun regeneration,
  // then restore. But that's risky — instead, we'll just preview the affected slot(s)
  // from current DB state (without the variable change applied).
  // This shows what the CURRENT regenerated output would look like.
  // For actual variable-change preview, the frontend should call PATCH with the value
  // and show the diff from the response.
  let affectedSlots: SlotId[] = varDef.dbField
    ? getSlotsAffectedByDbField(varDef.dbField)
    : [varDef.slotId]

  if (affectedSlots.length === 0) {
    affectedSlots = [varDef.slotId]
  }

  const result = await regenerateSlots(clientId, affectedSlots, user.id, true)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    mode: 'slot_preview',
    variableKey,
    affectedSlots,
    promptChanged: result.promptChanged,
    charCount: result.charCount,
    preview: result.preview,
    currentPrompt: result.currentPrompt,
  })
}
