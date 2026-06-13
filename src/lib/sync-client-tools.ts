/**
 * S6a: Shared utility for rebuilding and persisting clients.tools.
 *
 * Reads the client's current capability flags + approved knowledge chunk count,
 * then writes the computed tool array to clients.tools. Lightweight — no
 * Ultravox API call. The runtime uses clients.tools via toolOverrides at call time.
 *
 * Extracted from 4 duplicate implementations across knowledge routes (S5 → S6a).
 * S9.6e: Failures now alert via notifySystemFailure() (covers all callers).
 */
import { buildAgentTools } from '@/lib/ultravox'
import { notifySystemFailure } from '@/lib/admin-alerts'
import { recordClientEvent } from '@/lib/client-events'
import { normalizeToolNames } from '@/lib/tool-name-extractor'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function syncClientTools(
  svc: SupabaseClient,
  clientId: string,
): Promise<void> {
  try {
    const { data: client } = await svc
      .from('clients')
      .select('id, slug, niche, booking_enabled, forwarding_number, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, selected_plan, subscription_status, tools, listing_search_url')
      .eq('id', clientId)
      .single()
    if (!client) return

    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')

    const tools = buildAgentTools({
      niche: (client.niche as string | null) || undefined,
      booking_enabled: client.booking_enabled ?? false,
      slug: client.slug,
      forwarding_number: (client.forwarding_number as string | null) || undefined,
      sms_enabled: client.sms_enabled ?? false,
      twilio_number: (client.twilio_number as string | null) || undefined,
      knowledge_backend: (client.knowledge_backend as string | null) || undefined,
      knowledge_chunk_count: count ?? 0,
      transfer_conditions: (client.transfer_conditions as string | null) || undefined,
      selectedPlan: (client.selected_plan as string | null) || undefined,
      subscriptionStatus: (client.subscription_status as string | null) || undefined,
      listing_search_url: (client.listing_search_url as string | null) || undefined,
    })

    await svc.from('clients').update({ tools }).eq('id', clientId)
    void recordClientEvent(svc, {
      clientId,
      clientSlug: client.slug,
      eventType: 'tools.synced',
      eventGroup: 'runtime',
      actorType: 'system',
      source: 'sync-client-tools',
      status: 'success',
      severity: 'info',
      visibility: 'admin_only',
      summary: `Runtime tools rebuilt for ${client.slug}`,
      before: { tool_names: normalizeToolNames(client.tools as unknown[] | null | undefined, { source: 'sync-client-tools.before' }) },
      after: { tool_names: normalizeToolNames(tools, { source: 'sync-client-tools.after' }) },
      details: {
        knowledge_chunk_count: count ?? 0,
        knowledge_backend: client.knowledge_backend,
        selected_plan: client.selected_plan,
        subscription_status: client.subscription_status,
      },
    })
  } catch (err) {
    // S9.6e: Alert operator — silent tool registration failure = agent missing tools
    await notifySystemFailure(`syncClientTools failed for client ${clientId}`, err, svc, clientId)
    throw err // Re-throw so callers still see the error
  }
}
