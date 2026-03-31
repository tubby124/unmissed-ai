/**
 * service-catalog-sync.ts — D260: Sync client_services → prompt + Ultravox.
 *
 * When a service is created, updated, or deleted via the dashboard services routes,
 * this module rebuilds the SERVICES_OFFERED text, patches the stored system_prompt,
 * and syncs the updated prompt to the live Ultravox agent.
 *
 * Fire-and-forget: errors are logged but never fail the parent service operation.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { rowsToCatalogItems, formatServiceCatalog } from './service-catalog'
import { patchServicesOffered } from './prompt-patcher'
import { updateAgent, buildAgentTools } from './ultravox'
import { validatePrompt } from './settings-schema'
import { insertPromptVersion } from './prompt-version-utils'
import { reseedKnowledgeFromSettings } from './embeddings'

/**
 * Rebuild SERVICES_OFFERED from client_services and sync to prompt + Ultravox.
 *
 * Steps:
 *   1. Read active services from client_services
 *   2. Format as compact string via formatServiceCatalog()
 *   3. Update clients.services_offered in DB
 *   4. Patch system_prompt if the FAQ format line exists
 *   5. Reseed knowledge chunks for pgvector clients (D300)
 *   6. Sync updated prompt to Ultravox agent
 */
export async function syncServiceCatalogToPrompt(clientId: string): Promise<void> {
  const svc = createServiceClient()

  // 1. Read active services
  const { data: services } = await svc
    .from('client_services')
    .select('name, description, category, duration_mins, price, booking_notes')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('sort_order')
    .order('created_at')

  const catalog = rowsToCatalogItems(services ?? [])
  const servicesString = formatServiceCatalog(catalog)

  // 2. Read current prompt + agent config
  const { data: client } = await svc
    .from('clients')
    .select('system_prompt, services_offered, ultravox_agent_id, agent_voice_id, slug, forwarding_number, booking_enabled, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, transfer_conditions, business_facts, extra_qa')
    .eq('id', clientId)
    .single()

  if (!client) {
    console.warn(`[service-sync] Client not found: ${clientId}`)
    return
  }

  const updates: Record<string, unknown> = {
    services_offered: servicesString,
    updated_at: new Date().toISOString(),
  }

  // 3. Patch the prompt (matches **What services do you offer?** "..." format)
  let promptChanged = false
  if (client.system_prompt && servicesString) {
    const patched = patchServicesOffered(client.system_prompt, servicesString)
    if (patched !== client.system_prompt) {
      const v = validatePrompt(patched)
      if (v.valid) {
        updates.system_prompt = patched
        promptChanged = true
      } else {
        console.warn(`[service-sync] Prompt validation failed after service patch: ${v.error}`)
      }
    }
  }

  // 4. Save to DB
  const { error: dbError } = await svc.from('clients').update(updates).eq('id', clientId)
  if (dbError) {
    console.error(`[service-sync] DB update failed for client=${clientId}: ${dbError.message}`)
    return
  }

  // 5. Knowledge reseed for pgvector clients (D300)
  // Service changes should be searchable via queryKnowledge, not just in the prompt FAQ line
  if (client.knowledge_backend === 'pgvector') {
    try {
      await reseedKnowledgeFromSettings(
        clientId,
        client.business_facts,
        (client.extra_qa as { q: string; a: string }[]) ?? [],
      )
      console.log(`[service-sync] Knowledge reseeded for pgvector client=${clientId}`)
    } catch (err) {
      console.warn(`[service-sync] Knowledge reseed failed for client=${clientId}: ${err}`)
    }
  }

  // 6. Prompt version tracking (was step 5)
  if (promptChanged) {
    try {
      await insertPromptVersion(svc, {
        clientId,
        content: updates.system_prompt as string,
        changeDescription: 'Service catalog sync (D260)',
        triggeredByUserId: null,
        triggeredByRole: 'system',
        prevCharCount: client.system_prompt?.length ?? null,
      })
    } catch (err) {
      console.warn(`[service-sync] Prompt version insert failed: ${err}`)
    }
  }

  // 7. Sync to Ultravox if prompt changed and agent exists
  if (promptChanged && client.ultravox_agent_id) {
    try {
      let knowledgeChunkCount: number | undefined
      if (client.knowledge_backend === 'pgvector') {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: updates.system_prompt as string,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: client.knowledge_backend,
        knowledge_chunk_count: knowledgeChunkCount,
        transfer_conditions: client.transfer_conditions,
        selectedPlan: (client.selected_plan as string | null) || undefined,
        subscriptionStatus: (client.subscription_status as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)

      console.log(`[service-sync] Synced ${catalog.length} services for client=${clientId}`)
    } catch (err) {
      console.error(`[service-sync] Ultravox sync failed for client=${clientId}: ${err}`)
    }
  } else {
    console.log(`[service-sync] Updated services_offered for client=${clientId} (${catalog.length} services, prompt ${promptChanged ? 'patched' : 'unchanged'})`)
  }
}
