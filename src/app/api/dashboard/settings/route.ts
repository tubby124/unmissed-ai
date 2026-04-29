import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { sendAlert } from '@/lib/telegram'
import { insertPromptVersion } from '@/lib/prompt-version-utils'
import { reseedKnowledgeFromSettings } from '@/lib/embeddings'
import {
  settingsBodySchema,
  validatePrompt,
  buildUpdates,
  computeNeedsSync,
  isSectionEditAllowed,
  type PromptWarning,
} from '@/lib/settings-schema'
import { applyPromptPatches } from '@/lib/settings-patchers'
import { regenerateSlots, type RegenerateSlotResult } from '@/lib/slot-regenerator'
import { SLOT_IDS, type SlotId } from '@/lib/prompt-sections'
import { scheduleAutoRegen } from '@/lib/auto-regen'
import { evaluateAdminScopeGuard, EDIT_MODE_REQUIRED_RESPONSE } from '@/lib/admin-scope-guard'
import { recordAdminAudit, diffFields } from '@/lib/admin-audit'

// ── Agent sync helper ────────────────────────────────────────────────────────────

// Retry once on transient 5xx from Ultravox (e.g. 503 during deploy)
function isRetryableUltravoxError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\s5\d{2}\b/.test(msg)
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
  try { return await fn() } catch (err) {
    if (retries > 0 && isRetryableUltravoxError(err)) {
      await new Promise(r => setTimeout(r, delayMs))
      return withRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

interface SyncResult { synced: boolean; error?: string }

async function syncToUltravox(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  clientId: string,
  updates: Record<string, unknown>,
): Promise<SyncResult> {
  const { data: clientRow } = await supabase
    .from('clients')
    .select('slug, ultravox_agent_id, agent_voice_id, system_prompt, forwarding_number, booking_enabled, call_handling_mode, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, niche')
    .eq('id', clientId)
    .single()

  if (!clientRow?.ultravox_agent_id) return { synced: false }

  // Resolve all flags: use just-saved value if changed, otherwise current DB value
  const resolve = <T>(field: string, fallback: T): T =>
    field in updates ? (updates[field] as T) : fallback

  const fwdNumber = resolve('forwarding_number', clientRow.forwarding_number as string | null)
  const transferConditions = resolve('transfer_conditions', clientRow.transfer_conditions as string | null)
  const smsEnabled = resolve('sms_enabled', clientRow.sms_enabled ?? false)
  const knowledgeBackend = resolve('knowledge_backend', clientRow.knowledge_backend as string | null)
  const bookingEnabled = resolve('booking_enabled', clientRow.booking_enabled ?? false)
  const twilioNumber = resolve('twilio_number', clientRow.twilio_number as string | null)
  const promptToSync = typeof updates.system_prompt === 'string'
    ? updates.system_prompt as string
    : (clientRow.system_prompt ?? '') as string
  const voiceToSync = resolve('agent_voice_id', clientRow.agent_voice_id as string)

  try {
    // K15: check active chunk count so updateAgent can skip empty knowledge tool
    let knowledgeChunkCount: number | undefined
    if (knowledgeBackend === 'pgvector') {
      const svc = createServiceClient()
      const { count } = await svc
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'approved')
      knowledgeChunkCount = count ?? 0
    }

    // Single flags object used by both updateAgent() and buildAgentTools() — prevents drift
    const agentFlags: Parameters<typeof updateAgent>[1] = {
      systemPrompt: promptToSync,
      ...(voiceToSync ? { voice: voiceToSync } : {}),
      booking_enabled: bookingEnabled,
      slug: clientRow.slug,
      forwarding_number: fwdNumber || undefined,
      sms_enabled: smsEnabled,
      twilio_number: twilioNumber || undefined,
      knowledge_backend: knowledgeBackend,
      knowledge_chunk_count: knowledgeChunkCount,
      transfer_conditions: transferConditions,
      selectedPlan: (clientRow.selected_plan as string | null) || undefined,
      subscriptionStatus: (clientRow.subscription_status as string | null) || undefined,
      niche: (clientRow.niche as string | null) || undefined,
    }

    await withRetry(() => updateAgent(clientRow.ultravox_agent_id, agentFlags))

    // Keep clients.tools in sync — runtime-authoritative for live calls (Finding 6)
    const syncTools = buildAgentTools(agentFlags)
    await supabase.from('clients').update({ tools: syncTools }).eq('id', clientId)
    console.log(`[settings] Ultravox agent ${clientRow.ultravox_agent_id} synced (prompt=${typeof updates.system_prompt === 'string'} transfer=${!!fwdNumber} sms=${smsEnabled} twilio=${!!twilioNumber} knowledge=${knowledgeBackend} booking=${bookingEnabled})`)

    // G0.5: Record sync success for drift detection
    await supabase.from('clients').update({
      last_agent_sync_at: new Date().toISOString(),
      last_agent_sync_status: 'success',
      last_agent_sync_error: null,
    }).eq('id', clientId)

    // Post-enable verification: when booking_enabled is toggled ON, verify calendar tools are registered
    if ('booking_enabled' in updates && updates.booking_enabled === true) {
      const uvKey = process.env.ULTRAVOX_API_KEY
      if (uvKey) {
        try {
          const verifyRes = await fetch(`https://api.ultravox.ai/api/agents/${clientRow.ultravox_agent_id}`, {
            headers: { 'X-API-Key': uvKey },
          })
          if (verifyRes.ok) {
            const agentData = await verifyRes.json() as { callTemplate?: { selectedTools?: Array<{ temporaryTool?: { modelToolName?: string } }> } }
            const liveTools = agentData?.callTemplate?.selectedTools ?? []
            const hasCalendarTool = liveTools.some(t => t.temporaryTool?.modelToolName === 'checkCalendarAvailability')
            if (hasCalendarTool) {
              console.log(`[settings] ✓ Calendar tools verified on agent ${clientRow.ultravox_agent_id}`)
            } else {
              console.warn(`[settings] ⚠ booking_enabled=true but calendar tools NOT found on Ultravox agent — run /prompt-deploy to fix`)
              return { synced: false, error: 'booking_enabled is ON but calendar tools are missing from the Ultravox agent. Run /prompt-deploy to fix.' }
            }
          }
        } catch (verifyErr) {
          console.warn(`[settings] Calendar tool verification failed: ${verifyErr}`)
        }
      }
    }

    return { synced: true }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[settings] Ultravox agent sync failed: ${errMsg}`)

    // G0.5: Record sync failure for drift detection
    await supabase.from('clients').update({
      last_agent_sync_at: new Date().toISOString(),
      last_agent_sync_status: 'error',
      last_agent_sync_error: errMsg.slice(0, 500),
    }).eq('id', clientId)

    // SET-14: Alert operator via Telegram so drift doesn't go unnoticed
    const opToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const opChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (opToken && opChat) {
      sendAlert(opToken, opChat,
        `⚠️ Ultravox sync failed for <b>${clientRow.slug}</b>: ${errMsg.slice(0, 500)}. DB updated but agent config may be stale.`
      ).catch(() => { /* non-blocking */ })
    }

    return { synced: false, error: errMsg }
  }
}

// ── PATCH handler ────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()

  // 1 — Auth + client lookup
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  // 2 — Parse + validate body with Zod
  const rawBody = await req.json().catch(() => ({}))
  const parsed = settingsBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  let targetClientId = cu.client_id
  if (cu.role === 'admin' && body.client_id) {
    targetClientId = body.client_id
  }

  // 2.5 — Phase 0.5.3: cross-client edit guard (read-only by default)
  // No-op when ADMIN_REDESIGN_ENABLED is off — preserves current admin behavior.
  const guard = evaluateAdminScopeGuard({
    role: cu.role,
    ownClientId: cu.client_id,
    targetClientId,
    req,
    body: body as unknown as Record<string, unknown>,
  })
  if (!guard.allowed) {
    return NextResponse.json(EDIT_MODE_REQUIRED_RESPONSE, { status: 403 })
  }

  // 3 — Section edit permission check
  if (body.section_id && body.section_content !== undefined) {
    if (!isSectionEditAllowed(body.section_id, cu.role)) {
      return new NextResponse('Forbidden — admin-only section', { status: 403 })
    }
  }

  // 4 — Build DB updates from validated body
  const updates = buildUpdates(body, cu.role)
  let promptWarnings: PromptWarning[] = []

  // Validate direct system_prompt if provided
  if (typeof updates.system_prompt === 'string') {
    const v = validatePrompt(updates.system_prompt as string)
    if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 })
    promptWarnings = v.warnings
  }

  // 5 — Apply prompt auto-patches (identity → sensory → operational)
  // For voicemail/message_only clients, this does a full rebuild instead of surgical patching.
  const patchResult = await applyPromptPatches({ supabase, clientId: targetClientId, body, updates })
  if (patchResult.error) {
    return NextResponse.json({ error: patchResult.error }, { status: 400 })
  }
  promptWarnings = [...promptWarnings, ...patchResult.warnings]
  const promptRebuilt = patchResult.promptRebuilt === true

  // 6 — Empty check
  if (!Object.keys(updates).length) {
    return new NextResponse('Nothing to update', { status: 400 })
  }

  // Fields that trigger auto prompt rebuild (low-stakes, additive changes)
  const LOW_STAKES_REGEN_FIELDS = new Set([
    'business_hours_weekday', 'business_hours_weekend', 'services_offered',
    'context_data', 'business_facts', 'owner_name', 'after_hours_behavior',
    'after_hours_emergency_phone', 'callback_phone',
  ])

  // 6.5 — Phase 0.5.1: snapshot before-state for cross-client audit log.
  //  Only fetched when an admin is acting on another client. Cheap select scoped
  //  to the fields actually being mutated.
  const updateKeys = Object.keys(updates)
  let beforeRow: Record<string, unknown> | null = null
  if (guard.isCrossClient && updateKeys.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select(updateKeys.join(','))
      .eq('id', targetClientId)
      .maybeSingle()
    beforeRow = (data as unknown as Record<string, unknown>) ?? null
  }

  // 7 — Save to Supabase
  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', targetClientId)

  if (error) {
    if (guard.isCrossClient) {
      void recordAdminAudit({
        adminUserId: user.id,
        targetClientId,
        actingClientId: cu.client_id,
        route: '/api/dashboard/settings',
        method: 'PATCH',
        payload: updates,
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 7.5 — Phase 0.5.1: write the cross-client audit row (non-blocking).
  if (guard.isCrossClient && updateKeys.length > 0) {
    const { data: afterData } = await supabase
      .from('clients')
      .select(updateKeys.join(','))
      .eq('id', targetClientId)
      .maybeSingle()
    const afterRow = (afterData as unknown as Record<string, unknown>) ?? null
    const { beforeDiff, afterDiff } = diffFields(beforeRow, afterRow, updateKeys)
    void recordAdminAudit({
      adminUserId: user.id,
      targetClientId,
      actingClientId: cu.client_id,
      route: '/api/dashboard/settings',
      method: 'PATCH',
      payload: updates,
      beforeDiff,
      afterDiff,
    })
  }

  // Auto-rebuild prompt for low-stakes field changes (non-blocking)
  // Skips: direct system_prompt edits (already saved), voice/persona patches, hand_tuned clients
  const hasLowStakesChange = Object.keys(updates).some(k => LOW_STAKES_REGEN_FIELDS.has(k))
  const hasDirectPromptEdit = 'system_prompt' in updates
  const hasVoicePatch = 'voice_style_preset' in updates || 'agent_name' in updates || 'business_name' in updates
  if (hasLowStakesChange && !hasDirectPromptEdit && !hasVoicePatch) {
    scheduleAutoRegen(targetClientId, 'auto:settings_update')
  }

  // 8 — Reseed knowledge chunks when business_facts or extra_qa changed
  let knowledgeReseeded = false
  if ('business_facts' in updates || 'extra_qa' in updates) {
    const { data: freshClient } = await supabase
      .from('clients')
      .select('business_facts, extra_qa, knowledge_backend')
      .eq('id', targetClientId)
      .single()
    if (freshClient?.knowledge_backend === 'pgvector') {
      const facts = (freshClient.business_facts as string[] | string | null) ?? null
      const qa: { q: string; a: string }[] = Array.isArray(freshClient.extra_qa) ? freshClient.extra_qa : []
      try {
        const r = await reseedKnowledgeFromSettings(targetClientId, facts, qa)
        console.log(`[settings] Knowledge reseed: stored=${r.stored} failed=${r.failed} client=${targetClientId}`)
        knowledgeReseeded = true
      } catch (err) {
        console.error(`[settings] Knowledge reseed failed: ${err}`)
      }
    }
  }

  // 8b — Slot regeneration for niche_custom_variables (D283c) and city
  // niche_custom_variables can affect ANY slot (TRIAGE_DEEP, FORBIDDEN_EXTRA, etc.)
  // city is consumed by slot-regenerator and must trigger full regen on change.
  // Only fires on slot-composed prompts (new clients). Old clients use patchers.
  let slotRegenResult: RegenerateSlotResult | null = null
  if ('niche_custom_variables' in updates || 'city' in updates) {
    try {
      slotRegenResult = await regenerateSlots(
        targetClientId,
        [...SLOT_IDS],
        user.id,
      )
      if (slotRegenResult.promptChanged) {
        console.log(`[settings] Slot regeneration after niche_custom_variables change: client=${targetClientId} chars=${slotRegenResult.charCount}`)
        // Prompt was saved by regenerateSlots — mark updates so computeNeedsSync detects it
        updates.system_prompt = '__regenerated__'
      } else if (slotRegenResult.error) {
        // Not a fatal error — old-format prompts will get this and it's fine
        console.log(`[settings] Slot regen skipped: ${slotRegenResult.error}`)
      }
    } catch (err) {
      console.warn(`[settings] Slot regeneration failed: ${err}`)
    }
  }

  // 8c — D276: Booking toggle → regenerate TRIAGE_FLOW + GOAL slots
  // When booking_enabled changes, the triage questions and closing should adapt
  // to whether calendar booking is available. Only fires on slot-composed prompts.
  // Skips if niche_custom_variables already triggered a full regen above.
  if ('booking_enabled' in updates && !slotRegenResult?.promptChanged) {
    try {
      const bookingRegenResult = await regenerateSlots(
        targetClientId,
        ['conversation_flow', 'goal'] as const as SlotId[],
        user.id,
      )
      if (bookingRegenResult.promptChanged) {
        console.log(`[settings] D276: Regenerated conversation_flow+goal after booking_enabled change for client=${targetClientId}`)
        updates.system_prompt = '__regenerated__'
        slotRegenResult = bookingRegenResult
      } else if (bookingRegenResult.error) {
        console.log(`[settings] D276 slot regen skipped: ${bookingRegenResult.error}`)
      }
    } catch (err) {
      console.warn(`[settings] D276 booking slot regeneration failed: ${err}`)
    }
  }

  // 9 — Sync to Ultravox Agent (derived from field registry, not manual boolean)
  let ultravox_synced = false
  let ultravox_error: string | undefined

  // If slot regen already synced to Ultravox, skip the duplicate sync
  const regenAlreadySynced = slotRegenResult?.promptChanged === true
  if (regenAlreadySynced) {
    ultravox_synced = true
  } else if (computeNeedsSync(updates, knowledgeReseeded)) {
    const syncResult = await syncToUltravox(supabase, targetClientId, updates)
    ultravox_synced = syncResult.synced
    ultravox_error = syncResult.error
  }

  // 10 — Record prompt version with audit trail
  if (typeof updates.system_prompt === 'string') {
    const { data: latestVersion } = await supabase
      .from('prompt_versions')
      .select('char_count')
      .eq('client_id', targetClientId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = await insertPromptVersion(supabase, {
      clientId: targetClientId,
      content: updates.system_prompt as string,
      changeDescription: body.change_description || 'Manual update',
      triggeredByUserId: user.id,
      triggeredByRole: cu.role,
      prevCharCount: latestVersion?.char_count ?? null,
    })

    if (newVersion) {
      await supabase.from('clients')
        .update({ active_prompt_version_id: newVersion.id })
        .eq('id', targetClientId)
    }

    // Notify operator when a non-admin client edits their prompt
    if (cu.role !== 'admin') {
      try {
        const { data: adminCl } = await supabase
          .from('clients')
          .select('telegram_bot_token, telegram_chat_id, business_name')
          .eq('slug', 'hasan-sharif')
          .single()
        const { data: editedCl } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', targetClientId)
          .single()
        if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
          const name = editedCl?.business_name || 'Unknown client'
          const charLen = (updates.system_prompt as string).length
          const msg = `✏️ <b>${name}</b> edited their prompt (v${newVersion?.version ?? '?'}, ${charLen.toLocaleString()} chars).\nReview: /dashboard/settings`
          await sendAlert(adminCl.telegram_bot_token as string, adminCl.telegram_chat_id as string, msg)
        }
      } catch (err) {
        console.error(`[settings] Telegram prompt-change notification failed: ${err}`)
      }
    }
  }

  // 11 — Response
  return NextResponse.json({
    ok: true,
    ultravox_synced,
    ...(promptRebuilt ? { prompt_rebuilt: true } : {}),
    ...(ultravox_synced ? { last_sync_at: new Date().toISOString() } : {}),
    ...(ultravox_error ? { ultravox_error } : {}),
    ...(promptWarnings.length ? { warnings: promptWarnings } : {}),
    ...(typeof updates.system_prompt === 'string' ? { system_prompt: updates.system_prompt } : {}),
    ...(knowledgeReseeded ? { knowledge_reseeding: true } : {}),
  })
}
