/**
 * POST /api/dashboard/settings/sync-agent
 * Force-pushes the current system_prompt + voice from Supabase to the Ultravox agent.
 * Use when you suspect Supabase and Ultravox are out of sync.
 * Auth: owner or admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id

  if (!targetClientId) return NextResponse.json({ error: 'No client_id' }, { status: 400 })

  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, ultravox_agent_id, booking_enabled, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, niche')
    .eq('id', targetClientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.ultravox_agent_id) return NextResponse.json({ error: 'No Ultravox agent configured for this client' }, { status: 422 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system prompt to sync' }, { status: 422 })

  try {
    // K15: check active chunk count for knowledge tool guard
    const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
    let knowledgeChunkCount: number | undefined
    if (knowledgeBackend === 'pgvector') {
      const { count } = await svc
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('status', 'approved')
      knowledgeChunkCount = count ?? 0
    }

    // Pass all flags to updateAgent() — it handles tool construction for calendar,
    // transfer, SMS, knowledge, coaching, and hangUp tools centrally.
    const agentFlags: Parameters<typeof updateAgent>[1] = {
      systemPrompt: client.system_prompt,
      ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
      booking_enabled: client.booking_enabled ?? false,
      slug: client.slug,
      forwarding_number: (client.forwarding_number as string | null) || undefined,
      transfer_conditions: (client.transfer_conditions as string | null) || undefined,
      sms_enabled: client.sms_enabled ?? false,
      twilio_number: (client.twilio_number as string | null) || undefined,
      knowledge_backend: knowledgeBackend,
      knowledge_chunk_count: knowledgeChunkCount,
      selectedPlan: (client.selected_plan as string | null) || undefined,
      subscriptionStatus: (client.subscription_status as string | null) || undefined,
      niche: (client.niche as string | null) || undefined,
    }

    await updateAgent(client.ultravox_agent_id, agentFlags)

    // Keep clients.tools in sync — runtime-authoritative for live calls (Finding 6)
    const syncTools = buildAgentTools(agentFlags)
    await svc.from('clients').update({ tools: syncTools }).eq('id', client.id)

    console.log(`[sync-agent] Synced client=${targetClientId} agent=${client.ultravox_agent_id}`)
    return NextResponse.json({ ok: true, agent_id: client.ultravox_agent_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sync-agent] Failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
