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
import type { SupabaseClient } from '@supabase/supabase-js'

export async function syncClientTools(
  svc: SupabaseClient,
  clientId: string,
): Promise<void> {
  try {
    const { data: client } = await svc
      .from('clients')
      .select('id, slug, booking_enabled, forwarding_number, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, selected_plan, subscription_status')
      .eq('id', clientId)
      .single()
    if (!client) return

    const { count } = await svc
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'approved')

    const tools = buildAgentTools({
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
    })

    await svc.from('clients').update({ tools }).eq('id', clientId)
  } catch (err) {
    // S9.6e: Alert operator — silent tool registration failure = agent missing tools
    await notifySystemFailure(`syncClientTools failed for client ${clientId}`, err, svc, clientId)
    throw err // Re-throw so callers still see the error
  }
}
