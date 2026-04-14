/**
 * auto-regen.ts
 *
 * Fire-and-forget internal prompt rebuild. Called from settings + knowledge
 * routes after low-stakes data changes. Never blocks the route response.
 * Never throws.
 *
 * Guards:
 *  - hand_tuned clients are skipped
 *  - 5-minute cooldown (same as regenerate-prompt endpoint)
 *  - active clients only (status = 'active' | 'trialing')
 */
import { createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake } from '@/lib/prompt-builder'
import { updateAgent } from '@/lib/ultravox'
import { insertPromptVersion } from '@/lib/prompt-version-utils'

const REGEN_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes — matches regenerate-prompt endpoint

/**
 * Schedule a non-blocking prompt rebuild for the given client.
 * Safe to call anywhere — errors are swallowed and logged.
 */
export function scheduleAutoRegen(clientId: string, reason: string): void {
  void runAutoRegen(clientId, reason).catch(err =>
    console.error(`[auto-regen] Unhandled error for ${clientId}:`, err)
  )
}

async function runAutoRegen(clientId: string, reason: string): Promise<void> {
  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('id, slug, hand_tuned, status, agent_name, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, system_prompt, voice_style_preset, niche, custom_niche_config, gbp_summary, sonar_content')
    .eq('id', clientId)
    .single()

  if (!client) {
    console.warn(`[auto-regen] Client ${clientId} not found — skipping`)
    return
  }

  if (client.hand_tuned) {
    console.log(`[auto-regen] ${client.slug} is hand_tuned — skipping auto rebuild`)
    return
  }

  const activeStatuses = ['active', 'trialing']
  if (!activeStatuses.includes(client.status as string)) {
    console.log(`[auto-regen] ${client.slug} status=${client.status} — skipping`)
    return
  }

  const { data: lastVersion } = await svc
    .from('prompt_versions')
    .select('created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastVersion?.created_at) {
    const elapsed = Date.now() - new Date(lastVersion.created_at).getTime()
    if (elapsed < REGEN_COOLDOWN_MS) {
      console.log(`[auto-regen] ${client.slug} in cooldown (${Math.floor(elapsed / 1000)}s elapsed) — skipping`)
      return
    }
  }

  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!intake?.intake_json) {
    console.warn(`[auto-regen] No intake for ${client.slug} — skipping`)
    return
  }

  const intakeData = { ...intake.intake_json } as Record<string, unknown>

  if (client.agent_name) intakeData.db_agent_name = client.agent_name
  if (client.gbp_summary) intakeData.gbp_summary = client.gbp_summary
  if (client.sonar_content) intakeData.sonar_content = client.sonar_content
  const clientNiche = (client.niche as string | null) || 'other'
  if (clientNiche === 'other' && client.custom_niche_config && !intakeData.custom_niche_config) {
    intakeData.custom_niche_config = client.custom_niche_config
  }

  let knowledgeDocs = ''
  const { data: kDocs } = await svc
    .from('client_knowledge_docs')
    .select('content_text')
    .eq('client_id', clientId)
  if (kDocs?.length) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
  }

  const newPrompt = buildPromptFromIntake(intakeData, undefined, knowledgeDocs)

  const { data: prevVersion } = await svc
    .from('prompt_versions')
    .select('char_count')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const { error: saveErr } = await svc
    .from('clients')
    .update({ system_prompt: newPrompt })
    .eq('id', clientId)

  if (saveErr) {
    console.error(`[auto-regen] Failed to save prompt for ${client.slug}:`, saveErr)
    return
  }

  const newVersion = await insertPromptVersion(svc, {
    clientId,
    content: newPrompt,
    changeDescription: reason,
    triggeredByUserId: null,
    triggeredByRole: 'system',
    prevCharCount: prevVersion?.char_count ?? null,
  })

  if (newVersion) {
    await svc.from('clients')
      .update({ active_prompt_version_id: newVersion.id })
      .eq('id', clientId)
  }

  if (client.ultravox_agent_id) {
    try {
      await updateAgent(client.ultravox_agent_id as string, {
        systemPrompt: newPrompt,
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug as string,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: (client.knowledge_backend as string | null) || undefined,
      })
    } catch (syncErr) {
      console.error(`[auto-regen] Ultravox sync failed for ${client.slug}:`, syncErr)
    }
  }

  console.log(`[auto-regen] Rebuilt prompt for ${client.slug} (${newPrompt.length} chars) reason=${reason}`)
}
