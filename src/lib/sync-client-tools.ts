/**
 * S6a: Shared utility for rebuilding and persisting clients.tools.
 *
 * Reads the client's current capability flags + approved knowledge chunk count,
 * then writes the computed tool array to clients.tools. Lightweight — no
 * Ultravox API call. The runtime uses clients.tools via toolOverrides at call time.
 *
 * Extracted from 4 duplicate implementations across knowledge routes (S5 → S6a).
 */
import { buildAgentTools } from '@/lib/ultravox'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function syncClientTools(
  svc: SupabaseClient,
  clientId: string,
): Promise<void> {
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, booking_enabled, forwarding_number, sms_enabled, knowledge_backend, transfer_conditions')
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
    knowledge_backend: (client.knowledge_backend as string | null) || undefined,
    knowledge_chunk_count: count ?? 0,
    transfer_conditions: (client.transfer_conditions as string | null) || undefined,
  })

  await svc.from('clients').update({ tools }).eq('id', clientId)
}
