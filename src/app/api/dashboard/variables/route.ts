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
import { patchAgentName, patchBusinessName, patchOwnerName } from '@/lib/prompt-patcher'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

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
  // 1 — Auth + Phase 3 Wave B scope guard
  const supabase = await createServerClient()
  const body = await req.json().catch(() => null)
  if (!body || typeof body.variableKey !== 'string' || typeof body.value !== 'string') {
    return NextResponse.json({ error: 'Required: { variableKey: string, value: string }' }, { status: 400 })
  }

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied
  const user = scope.user
  const cu = { role: scope.role, client_id: scope.ownClientId }

  const { variableKey, value } = body as { variableKey: string; value: string }
  const trimmedValue = value.trim()

  // Admin can edit variables for any client
  const clientId = scope.targetClientId

  // 3 — Look up variable in registry
  const varDef = getVariable(variableKey)
  if (!varDef) {
    return NextResponse.json({ error: `Unknown variable: ${variableKey}` }, { status: 400 })
  }

  // 4 — Write to correct storage location
  const svc = createServiceClient()
  let affectedSlots: SlotId[] = []

  // Safety-net inputs — capture the OLD value of identity-class fields BEFORE the
  // DB write so we can word-boundary patch the stored prompt across every slot
  // afterward. Slot regen alone only touches the slots tagged in the registry,
  // but AGENT_NAME / OWNER_NAME / BUSINESS_NAME appear in conversation_flow,
  // inline_examples, escalation_transfer, after_hours, faq_pairs, etc.
  // Without this backstop the live prompt retains stale names (D371 root cause).
  const NAME_FIELDS = new Set(['agent_name', 'owner_name', 'business_name'])
  let oldName: string | null = null
  if (varDef.dbField && NAME_FIELDS.has(varDef.dbField)) {
    const { data: priorRow } = await svc
      .from('clients')
      .select(`${varDef.dbField}`)
      .eq('id', clientId)
      .single()
    oldName = (priorRow?.[varDef.dbField as keyof typeof priorRow] as string | null) ?? null
  }

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
      if (scope.guard.isCrossClient) {
        void auditAdminWrite({
          scope,
          route: '/api/dashboard/variables',
          method: 'PATCH',
          payload: { client_id: clientId, variable_key: variableKey },
          status: 'error',
          errorMessage: updateErr.message,
        })
      }
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
      if (scope.guard.isCrossClient) {
        void auditAdminWrite({
          scope,
          route: '/api/dashboard/variables',
          method: 'PATCH',
          payload: { client_id: clientId, variable_key: variableKey },
          status: 'error',
          errorMessage: updateErr.message,
        })
      }
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

  // 5b — Safety-net cross-slot patch for name fields.
  // CLOSE_PERSON / AGENT_NAME / BUSINESS_NAME appear across many slots that
  // aren't tagged in the registry. Regen only rebuilt the slots tagged with
  // dbField — every other slot still references the old name. Word-boundary
  // patch the stored prompt and re-sync Ultravox so the live agent stops
  // saying the old name.
  let safetyNetApplied = false
  if (oldName && varDef.dbField && NAME_FIELDS.has(varDef.dbField) && oldName !== trimmedValue) {
    const { data: latest } = await svc
      .from('clients')
      .select('id, system_prompt, ultravox_agent_id, agent_name, business_name, owner_name, agent_voice_id, booking_enabled, forwarding_number, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, slug, niche, selected_plan, subscription_status, tools, after_hours_behavior')
      .eq('id', clientId)
      .single()

    if (latest?.system_prompt) {
      let patched = latest.system_prompt as string
      if (varDef.dbField === 'agent_name')    patched = patchAgentName(patched, oldName, trimmedValue)
      if (varDef.dbField === 'owner_name')    patched = patchOwnerName(patched, oldName, trimmedValue)
      if (varDef.dbField === 'business_name') patched = patchBusinessName(patched, oldName, trimmedValue)

      if (patched !== latest.system_prompt) {
        await svc
          .from('clients')
          .update({ system_prompt: patched, updated_at: new Date().toISOString() })
          .eq('id', clientId)

        // Push the patched prompt to the live Ultravox agent.
        if (latest.ultravox_agent_id) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const flags: any = {
              systemPrompt: patched,
              voice: latest.agent_voice_id ?? undefined,
              slug: latest.slug,
              niche: latest.niche,
              business_name: latest.business_name,
              agent_name: latest.agent_name,
              booking_enabled: !!latest.booking_enabled,
              forwarding_number: latest.forwarding_number ?? null,
              transfer_conditions: latest.transfer_conditions ?? null,
              sms_enabled: !!latest.sms_enabled,
              twilio_number: latest.twilio_number ?? null,
              knowledge_backend: latest.knowledge_backend ?? null,
              selected_plan: latest.selected_plan,
              subscription_status: latest.subscription_status,
              after_hours_behavior: latest.after_hours_behavior ?? null,
            }
            await updateAgent(latest.ultravox_agent_id, flags)
            const syncTools = buildAgentTools(flags)
            await svc.from('clients').update({
              tools: syncTools,
              last_agent_sync_at: new Date().toISOString(),
              last_agent_sync_status: 'success',
              last_agent_sync_error: null,
            }).eq('id', clientId)
          } catch (e) {
            const errMsg = (e as Error).message
            console.error('[variables] safety-net Ultravox sync failed:', errMsg)
            await svc.from('clients').update({
              last_agent_sync_at: new Date().toISOString(),
              last_agent_sync_status: 'error',
              last_agent_sync_error: errMsg.slice(0, 500),
            }).eq('id', clientId)
          }
        }
        safetyNetApplied = true
      }
    }
  }

  // 5c — Generalized Ultravox sync. regenerateSlots already wrote the new prompt to
  // clients.system_prompt for any variable change; the live agent still runs the
  // previously-deployed template until updateAgent() is called. The 5b NAME_FIELDS
  // block only covers identity-class vars and only when patchAgent/Owner/BusinessName
  // produces a delta — it skips most vars (GREETING_LINE in JSONB, hours, etc.) and
  // also skips name-class edits when the old name doesn't word-boundary match. This
  // catches everything the safety-net misses so the next call uses the new prompt.
  let promptSyncApplied = false
  if (result.promptChanged === true && !safetyNetApplied) {
    const { data: latest } = await svc
      .from('clients')
      .select('id, system_prompt, ultravox_agent_id, agent_name, business_name, owner_name, agent_voice_id, booking_enabled, forwarding_number, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, slug, niche, selected_plan, subscription_status, after_hours_behavior')
      .eq('id', clientId)
      .single()

    if (latest?.ultravox_agent_id && latest?.system_prompt) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flags: any = {
          systemPrompt: latest.system_prompt,
          voice: latest.agent_voice_id ?? undefined,
          slug: latest.slug,
          niche: latest.niche,
          business_name: latest.business_name,
          agent_name: latest.agent_name,
          booking_enabled: !!latest.booking_enabled,
          forwarding_number: latest.forwarding_number ?? null,
          transfer_conditions: latest.transfer_conditions ?? null,
          sms_enabled: !!latest.sms_enabled,
          twilio_number: latest.twilio_number ?? null,
          knowledge_backend: latest.knowledge_backend ?? null,
          selected_plan: latest.selected_plan,
          subscription_status: latest.subscription_status,
          after_hours_behavior: latest.after_hours_behavior ?? null,
        }
        await updateAgent(latest.ultravox_agent_id, flags)
        const syncTools = buildAgentTools(flags)
        await svc.from('clients').update({
          tools: syncTools,
          last_agent_sync_at: new Date().toISOString(),
          last_agent_sync_status: 'success',
          last_agent_sync_error: null,
        }).eq('id', clientId)
        promptSyncApplied = true
      } catch (e) {
        const errMsg = (e as Error).message
        console.error('[variables] generalized Ultravox sync failed:', errMsg)
        await svc.from('clients').update({
          last_agent_sync_at: new Date().toISOString(),
          last_agent_sync_status: 'error',
          last_agent_sync_error: errMsg.slice(0, 500),
        }).eq('id', clientId)
      }
    }
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

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/variables',
      method: 'PATCH',
      payload: { client_id: clientId, variable_key: variableKey, char_count: result.charCount, affected_slots: affectedSlots },
    })
  }

  return NextResponse.json({
    ok: true,
    affectedSlots,
    charCount: result.charCount,
    promptChanged: result.promptChanged || safetyNetApplied,
    safetyNetApplied,
    promptSyncApplied,
    ...(newPrompt ? { newPrompt } : {}),
  })
}
