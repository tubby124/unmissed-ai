/**
 * POST /api/dashboard/regenerate-prompt
 *
 * Admin or owner. Re-generates system_prompt from latest intake_submission,
 * inserts a prompt_versions record with audit trail, and syncs the Ultravox agent.
 *
 * S6d: Audit trail — logs triggered_by_user_id, triggered_by_role, char_count, prev_char_count
 * S6e: Rate limiting — max 1 regeneration per 5 minutes per client (HTTP 429)
 * S6f: Intake fallback — if no intake exists, refreshes tools/voice from current prompt + settings
 *
 * Body: { clientId: string, agentModeOverride?: AgentMode }
 *   agentModeOverride: admin or owner (scoped) — forces a full Phase 2b deep-mode rebuild with this mode.
 *   When provided: S6f fallback is SUPPRESSED (fail loudly if no intake exists).
 *   When absent: existing behavior is unchanged.
 *
 * Returns: { ok, saved, synced, source, error?, cooldown_seconds? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake, VOICE_PRESETS } from '@/lib/prompt-builder'
import { VOICE_TONE_PRESETS } from '@/lib/prompt-config/voice-tone-presets'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { insertPromptVersion } from '@/lib/prompt-version-utils'
import { patchCalendarBlock, patchSmsBlock, patchVoiceStyleSection, patchAgentName, getServiceType, getClosePerson } from '@/lib/prompt-patcher'
import { buildAgentModeRebuildPrompt, AGENT_MODE_VALUES, type AgentMode } from '@/lib/agent-mode-rebuild'
import { rowsToCatalogItems } from '@/lib/service-catalog'

const REGEN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

// Phase E.5 Wave 7 — extracted for unit testing. Founding-4 clients
// (hand_tuned=true) are protected from silent overwrite. Admins can force with
// { force: true } after an explicit confirm modal. This predicate has to stay
// in lockstep with the 409 branch below — the shared helper prevents drift.
export function shouldBlockHandTunedRegen(
  handTuned: boolean | null | undefined,
  force: boolean,
): boolean {
  return handTuned === true && !force
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { clientId?: string; agentModeOverride?: string; force?: boolean }
  const { clientId } = body
  // Phase E Wave 7 safety flag — callers can explicitly opt into overwriting a
  // hand-tuned prompt (e.g. admin confirmation modal). Defaults to false so the
  // guard fires unless the caller is deliberate.
  const force = body.force === true
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Scope check: owners can only regenerate their own client
  if (cu.role === 'owner' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // agentModeOverride: owners can pass this for their own client (deep-mode rebuild)
  const agentModeOverride = body.agentModeOverride as AgentMode | undefined
  if (agentModeOverride !== undefined && !AGENT_MODE_VALUES.includes(agentModeOverride)) {
    return NextResponse.json({ error: `Invalid agentModeOverride: ${agentModeOverride}` }, { status: 400 })
  }

  const svc = createServiceClient()

  // ── S6e: Rate limiting — check last regeneration timestamp ─────────────────
  const { data: lastRegen } = await svc
    .from('prompt_versions')
    .select('created_at, triggered_by_role')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Skip cooldown for admins and when the only prior regen was system-initiated
  // (e.g. provisioning). Without this, a fresh trial's first Day1 edit is blocked.
  if (lastRegen?.created_at && cu.role !== 'admin' && lastRegen.triggered_by_role !== 'system') {
    const elapsed = Date.now() - new Date(lastRegen.created_at).getTime()
    if (elapsed < REGEN_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((REGEN_COOLDOWN_MS - elapsed) / 1000)
      return NextResponse.json(
        {
          error: `Prompt was updated ${Math.floor(elapsed / 1000)}s ago. Please wait ${remainingSeconds}s before regenerating.`,
          cooldown_seconds: remainingSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(remainingSeconds) },
        },
      )
    }
  }

  // ── Get client — include all fields needed for buildAgentTools ─────────────
  // Phase E Wave 8 follow-up: also read the 6 Wave 1 onboarding-v1 columns so
  // dashboard edits to today_update / business_notes / D408 chips / fields_to_collect
  // flow into the regenerated prompt. Without these, dashboard saves land in the
  // clients row but the next regenerate would read only intake_json and miss them.
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, agent_name, status, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, system_prompt, voice_style_preset, niche, custom_niche_config, service_catalog, agent_mode, hand_tuned, today_update, business_notes, unknown_answer_behavior, pricing_policy, calendar_mode, fields_to_collect')
    .eq('id', clientId)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // ── Phase E Wave 7 — hand_tuned safety gate (D.5 debt item H) ──────────────
  // Founding-4 clients (hasan-sharif, exp-realty, urban-vibe, windshield-hub) have
  // hand_tuned = true so their hand-crafted prompts cannot be silently clobbered
  // via the dashboard sync button or an owner-triggered regenerate. Admins can
  // force the overwrite by passing { force: true } from a confirmation modal.
  if (shouldBlockHandTunedRegen(client.hand_tuned as boolean | null, force)) {
    return NextResponse.json(
      {
        error: 'This client has a hand-tuned system prompt. Regenerating would overwrite the custom text. Pass { force: true } to confirm.',
        handTuned: true,
      },
      { status: 409 },
    )
  }

  // ── S6d: Capture prev char count for audit trail ───────────────────────────
  const prevCharCount = typeof client.system_prompt === 'string'
    ? (client.system_prompt as string).length
    : 0

  // ── S6f: Get latest intake submission (with fallback) ──────────────────────
  // Fix: intake_submissions uses `submitted_at`, not `created_at`. The wrong
  // column name caused PostgREST to 400 silently, making every dashboard-triggered
  // regen fall through to the S6f fallback (prompt-unchanged) path.
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', client.slug)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  let newPrompt: string
  let regenSource: 'intake' | 'refresh'
  let agentModeWriteBack: { agent_mode: AgentMode; call_handling_mode: string } | undefined

  if (agentModeOverride) {
    // ── Phase 4 deep-mode rebuild path (admin-only) ───────────────────────────
    // Uses the shared helper so preview and confirm produce identical prompts.
    // Throws if no intake exists (no S6f fallback for explicit mode overrides).
    let rebuildResult
    try {
      rebuildResult = await buildAgentModeRebuildPrompt(svc, clientId, agentModeOverride)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    newPrompt = rebuildResult.newPrompt
    regenSource = 'intake'
    agentModeWriteBack = {
      agent_mode: agentModeOverride,
      call_handling_mode: rebuildResult.effectiveCallHandlingMode,
    }
    console.log(
      `[regenerate-prompt] deep-mode rebuild: mode=${agentModeOverride} ` +
      `call_handling_mode=${rebuildResult.effectiveCallHandlingMode} ` +
      `chars=${newPrompt.length}`,
    )
  } else if (intake?.intake_json) {
    // ── Standard path: regenerate from intake data ────────────────────────────
    const intakeData = { ...intake.intake_json } as Record<string, unknown>

    // For active clients, preserve the current agent_name
    if (client.agent_name && client.status === 'active') {
      intakeData.db_agent_name = client.agent_name
    }

    // Phase E Wave 8 follow-up: merge Wave 1 onboarding-v1 columns from the clients
    // row so dashboard edits flow into the regenerated prompt. These columns are the
    // source of truth once set — they override intake_json because the owner edited
    // them after provision. NULL columns fall through to whatever intake_json has.
    if (client.today_update !== null && client.today_update !== undefined) intakeData.today_update = client.today_update
    if (client.business_notes !== null && client.business_notes !== undefined) intakeData.business_notes = client.business_notes
    if (client.unknown_answer_behavior !== null && client.unknown_answer_behavior !== undefined) intakeData.unknown_answer_behavior = client.unknown_answer_behavior
    if (client.pricing_policy !== null && client.pricing_policy !== undefined) intakeData.pricing_policy = client.pricing_policy
    if (client.calendar_mode !== null && client.calendar_mode !== undefined) intakeData.calendar_mode = client.calendar_mode
    if (client.fields_to_collect !== null && client.fields_to_collect !== undefined) intakeData.fields_to_collect = client.fields_to_collect
    // Bug #12 fix: voice_style_preset can be changed in settings after onboarding. DB column
    // is source of truth — merge it into intakeData so buildPromptFromIntake picks it up
    // directly, rather than relying solely on the step-4 patchVoiceStyleSection call.
    if (client.voice_style_preset !== null && client.voice_style_preset !== undefined) intakeData.voice_style_preset = client.voice_style_preset
    // P1: voicemail builder needs twilio_number to gate "text this number" lines
    if (client.twilio_number) intakeData.twilio_number = client.twilio_number

    // For 'other' niche: inject custom_niche_config from client row so admin overrides are respected
    const clientNiche = (client.niche as string | null) || 'other'
    if (clientNiche === 'other' && client.custom_niche_config && !intakeData.custom_niche_config) {
      intakeData.custom_niche_config = client.custom_niche_config
    }

    // Fetch knowledge docs
    let knowledgeDocs = ''
    const { data: kDocs } = await svc
      .from('client_knowledge_docs')
      .select('content_text')
      .eq('client_id', clientId)
    if (kDocs && kDocs.length > 0) {
      knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
    }

    // Inject service_catalog: prefer active rows from client_services table;
    // fall back to JSONB clients.service_catalog for clients without relational rows.
    const { data: serviceRows } = await svc
      .from('client_services')
      .select('name, description, category, duration_mins, price, booking_notes, active, sort_order')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('sort_order')
      .order('created_at')
    if (serviceRows && serviceRows.length > 0) {
      intakeData.service_catalog = rowsToCatalogItems(serviceRows as Parameters<typeof rowsToCatalogItems>[0])
    } else if (client.service_catalog) {
      intakeData.service_catalog = client.service_catalog
    }

    newPrompt = buildPromptFromIntake(intakeData, undefined, knowledgeDocs)
    regenSource = 'intake'

    // ── Re-apply manual patches so regeneration preserves customizations ──────
    // 1. Agent name: if the DB has a custom name different from the intake name, patch it
    if (client.agent_name) {
      const intakeAgentName = (intake.intake_json as Record<string, unknown>)?.agent_name as string | undefined
      if (intakeAgentName && intakeAgentName !== client.agent_name) {
        newPrompt = patchAgentName(newPrompt, intakeAgentName, client.agent_name as string)
        console.log(`[regenerate-prompt] Re-applied agent name: "${intakeAgentName}" → "${client.agent_name}"`)
      }
    }

    // 2. Calendar booking block: if booking is enabled, ensure the block is present
    if (client.booking_enabled) {
      const niche = (client.niche as string | null) || 'other'
      newPrompt = patchCalendarBlock(
        newPrompt,
        true,
        getServiceType(niche),
        getClosePerson(newPrompt, client.agent_name as string | null),
      )
      console.log(`[regenerate-prompt] Re-applied calendar booking block`)
    }

    // 3. SMS follow-up block: if sms_enabled, ensure the block is present post-regen (mode-aware)
    if (client.sms_enabled) {
      newPrompt = patchSmsBlock(newPrompt, true, client.agent_mode as string | null)
      console.log(`[regenerate-prompt] Re-applied SMS follow-up block (mode=${client.agent_mode ?? 'default'})`)
    }

    // 4. Voice style: re-patch the tone/style section if a preset was applied
    // Check both legacy VOICE_PRESETS and founding-4 VOICE_TONE_PRESETS
    const voicePreset = client.voice_style_preset as string | null
    if (voicePreset) {
      const preset = VOICE_PRESETS[voicePreset] || VOICE_TONE_PRESETS[voicePreset]
      if (preset) {
        newPrompt = patchVoiceStyleSection(newPrompt, preset.toneStyleBlock, preset.fillerStyle)
        console.log(`[regenerate-prompt] Re-applied voice style preset: "${voicePreset}"`)
      }
    }
  } else {
    // S6f fallback: no intake exists — refresh from current prompt + re-sync tools/voice
    if (!client.system_prompt) {
      return NextResponse.json(
        { error: 'No intake submission and no existing prompt for this client. Complete the intake form first.' },
        { status: 404 },
      )
    }
    newPrompt = client.system_prompt as string
    regenSource = 'refresh'
  }

  // ── S7f: Insert prompt_versions record via shared utility ───────────────────
  const delta = newPrompt.length - prevCharCount
  const changeDesc = regenSource === 'intake'
    ? `Re-generated from intake (${newPrompt.length} chars, delta ${delta > 0 ? '+' : ''}${delta})`
    : `Refreshed agent (tools/voice re-sync, prompt unchanged, ${newPrompt.length} chars)`

  // Phase H audit — flag when an admin used { force: true } to override the
  // hand_tuned gate. Only writes `true` when both conditions hold: client was
  // hand_tuned AND caller passed force. Normal regens on non-hand-tuned clients
  // default to false. Lets us grep prompt_versions later for override events.
  const forceOverrodeHandTuned = client.hand_tuned === true && force

  const newVersion = await insertPromptVersion(svc, {
    clientId,
    content: newPrompt,
    changeDescription: forceOverrodeHandTuned
      ? `${changeDesc} (admin force-override of hand_tuned prompt)`
      : changeDesc,
    triggeredByUserId: user.id,
    triggeredByRole: cu.role,
    prevCharCount,
    forceOverrodeHandTuned,
  })

  // Save to clients table
  const dbUpdates: Record<string, unknown> = {
    system_prompt: newPrompt,
    updated_at: new Date().toISOString(),
  }
  if (newVersion) dbUpdates.active_prompt_version_id = newVersion.id
  // Write agent_mode + call_handling_mode when a deep-mode rebuild was performed
  if (agentModeWriteBack) {
    dbUpdates.agent_mode = agentModeWriteBack.agent_mode
    dbUpdates.call_handling_mode = agentModeWriteBack.call_handling_mode
  }
  await svc.from('clients').update(dbUpdates).eq('id', clientId)

  // ── Sync to Ultravox agent if one exists ───────────────────────────────────
  if (client.ultravox_agent_id) {
    try {
      // Count knowledge chunks for K15 skip-if-empty check
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: newPrompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
        niche: (client.niche as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync (S1a pattern)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[regenerate-prompt] Ultravox sync failed:', msg)
      return NextResponse.json({ ok: true, saved: true, synced: false, source: regenSource, error: msg })
    }
  }

  const modeTag = agentModeWriteBack ? ` mode=${agentModeWriteBack.agent_mode}` : ''
  console.log(`[regenerate-prompt] client=${client.slug} v${newVersion?.version ?? '?'} source=${regenSource}${modeTag} role=${cu.role} chars=${newPrompt.length} delta=${delta}`)

  return NextResponse.json({ ok: true, saved: true, synced: true, source: regenSource })
}
