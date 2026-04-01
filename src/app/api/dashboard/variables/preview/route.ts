/**
 * D305: Variable Preview API — POST /api/dashboard/variables/preview
 *
 * Returns a dry-run preview of what a variable edit would produce
 * without actually saving to DB or syncing to Ultravox.
 *
 * Supports two modes:
 * - Variable change preview: { variableKey, value } — shows what prompt would look like WITH the change
 * - Full recompose preview: { recompose: true } — shows what full recompose would produce
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getVariable } from '@/lib/prompt-variable-registry'
import { clientRowToIntake, recomposePrompt } from '@/lib/slot-regenerator'
import { buildSlotContext, buildPromptFromSlots } from '@/lib/prompt-slots'

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

  // Mode B: Prospective variable change preview
  if (typeof body.variableKey !== 'string' || typeof body.value !== 'string') {
    return NextResponse.json({ error: 'Required: { variableKey, value } or { recompose: true }' }, { status: 400 })
  }

  const { variableKey, value } = body as { variableKey: string; value: string }
  const varDef = getVariable(variableKey)
  if (!varDef) {
    return NextResponse.json({ error: `Unknown variable: ${variableKey}` }, { status: 400 })
  }

  // Read current client state
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const currentPrompt = client.system_prompt as string | null
  if (!currentPrompt) {
    return NextResponse.json({ error: 'No system_prompt on client' }, { status: 400 })
  }

  // Read services
  const { data: services } = await svc
    .from('client_services')
    .select('name, description, category, duration_mins, price, booking_notes')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  // Count knowledge chunks
  let knowledgeChunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')
    knowledgeChunkCount = count ?? 0
  }

  // Build a simulated client row with the variable change applied
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulatedClient: Record<string, any> = { ...client }
  if (varDef.dbField) {
    // Variable maps to a DB column — override it
    simulatedClient[varDef.dbField] = value.trim()
  } else {
    // Variable lives in niche_custom_variables — merge the change
    const currentNcv = (client.niche_custom_variables as Record<string, unknown>) ?? {}
    simulatedClient.niche_custom_variables = { ...currentNcv, [variableKey]: value.trim() }
  }

  // Build preview prompt from simulated state
  const intake = clientRowToIntake(simulatedClient, services ?? [], knowledgeChunkCount)
  const ctx = buildSlotContext(intake)
  const previewPrompt = buildPromptFromSlots(ctx)

  return NextResponse.json({
    ok: true,
    mode: 'variable_preview',
    variableKey,
    affectedSlots: [varDef.slotId],
    promptChanged: previewPrompt !== currentPrompt,
    charCount: previewPrompt.length,
    preview: previewPrompt,
    currentPrompt,
  })
}
