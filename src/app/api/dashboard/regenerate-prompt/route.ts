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
 * Body: { clientId: string }
 * Returns: { ok, saved, synced, source, error?, cooldown_seconds? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake, VOICE_PRESETS } from '@/lib/prompt-builder'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { insertPromptVersion } from '@/lib/prompt-version-utils'
import { patchCalendarBlock, patchVoiceStyleSection, patchAgentName, getServiceType, getClosePerson } from '@/lib/prompt-patcher'

const REGEN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

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

  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Scope check: owners can only regenerate their own client
  if (cu.role === 'owner' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── S6e: Rate limiting — check last regeneration timestamp ─────────────────
  const { data: lastRegen } = await svc
    .from('prompt_versions')
    .select('created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastRegen?.created_at) {
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
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, agent_name, status, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions, system_prompt, voice_style_preset, niche')
    .eq('id', clientId)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // ── S6d: Capture prev char count for audit trail ───────────────────────────
  const prevCharCount = typeof client.system_prompt === 'string'
    ? (client.system_prompt as string).length
    : 0

  // ── S6f: Get latest intake submission (with fallback) ──────────────────────
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', client.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let newPrompt: string
  let regenSource: 'intake' | 'refresh'

  if (intake?.intake_json) {
    // Primary path: regenerate from intake data
    const intakeData = { ...intake.intake_json } as Record<string, unknown>

    // For active clients, preserve the current agent_name
    if (client.agent_name && client.status === 'active') {
      intakeData.db_agent_name = client.agent_name
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

    // 3. Voice style: if a preset was applied, re-patch the tone/style section
    const voicePreset = client.voice_style_preset as string | null
    if (voicePreset) {
      const preset = VOICE_PRESETS[voicePreset]
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

  const newVersion = await insertPromptVersion(svc, {
    clientId,
    content: newPrompt,
    changeDescription: changeDesc,
    triggeredByUserId: user.id,
    triggeredByRole: cu.role,
    prevCharCount,
  })

  // Save to clients table
  const dbUpdates: Record<string, unknown> = {
    system_prompt: newPrompt,
    updated_at: new Date().toISOString(),
  }
  if (newVersion) dbUpdates.active_prompt_version_id = newVersion.id
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
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
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

  console.log(`[regenerate-prompt] client=${client.slug} v${newVersion?.version ?? '?'} source=${regenSource} role=${cu.role} chars=${newPrompt.length} delta=${delta}`)

  return NextResponse.json({ ok: true, saved: true, synced: true, source: regenSource })
}
