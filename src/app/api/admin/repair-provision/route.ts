/**
 * POST /api/admin/repair-provision
 *
 * Re-runs activation steps for a stuck client. Idempotent — safe to call multiple times.
 * Only runs steps that haven't completed yet (checks current state before each step).
 *
 * Body: { client_id: string }
 *
 * Steps:
 * 1. If no ultravox_agent_id → skip (agent must be created via /provision or /trial route)
 * 2. If tools array empty → syncClientTools (rebuilds from DB flags)
 * 3. If last_agent_sync_status = 'error' → re-run updateAgent
 * 4. If subscription_status = 'trialing' and twilio_number missing → skip (trials don't get numbers)
 * 5. If subscription_status != 'trialing' and twilio_number missing → flag (requires manual Twilio provision)
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { syncClientTools } from '@/lib/sync-client-tools'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = body.client_id as string | undefined
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data: client } = await svc
    .from('clients')
    .select('id, slug, ultravox_agent_id, twilio_number, tools, system_prompt, agent_voice_id, booking_enabled, sms_enabled, forwarding_number, transfer_conditions, knowledge_backend, selected_plan, subscription_status, last_agent_sync_status, niche')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const repairs: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  // Step 1: Check agent exists
  if (!client.ultravox_agent_id) {
    skipped.push('no ultravox_agent_id — must re-provision via /provision or /trial route')
  }

  // Step 2: Rebuild tools if empty
  if (client.ultravox_agent_id && (!client.tools || (Array.isArray(client.tools) && client.tools.length === 0))) {
    try {
      await syncClientTools(svc, clientId)
      repairs.push('rebuilt tools array via syncClientTools')
    } catch (err) {
      errors.push(`syncClientTools failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Step 3: Re-sync agent if last sync failed
  if (client.ultravox_agent_id && (client.last_agent_sync_status as string) === 'error') {
    try {
      // Count approved knowledge chunks
      const { count: knowledgeChunkCount } = await svc
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'approved')

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: (client.system_prompt as string) ?? '',
        voice: (client.agent_voice_id as string) ?? undefined,
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string) ?? undefined,
        sms_enabled: client.sms_enabled ?? false,
        twilio_number: (client.twilio_number as string) ?? undefined,
        knowledge_backend: (client.knowledge_backend as string) ?? undefined,
        knowledge_chunk_count: knowledgeChunkCount ?? 0,
        transfer_conditions: (client.transfer_conditions as string) ?? undefined,
        selectedPlan: (client.selected_plan as string) ?? undefined,
        subscriptionStatus: (client.subscription_status as string) ?? undefined,
        niche: (client.niche as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Sync tools + record success
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({
        tools: syncTools,
        last_agent_sync_at: new Date().toISOString(),
        last_agent_sync_status: 'success',
        last_agent_sync_error: null,
      }).eq('id', clientId)

      repairs.push('re-synced agent (was in error state)')
    } catch (err) {
      errors.push(`updateAgent re-sync failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Step 4: Check Twilio number
  const isTrial = (client.subscription_status as string) === 'trialing'
  if (!client.twilio_number && !isTrial) {
    skipped.push('missing twilio_number on paid client — requires manual Twilio provision via /admin/numbers')
  }

  return NextResponse.json({
    ok: true,
    slug: client.slug,
    repairs,
    skipped,
    errors,
    repaired_at: new Date().toISOString(),
  })
}
