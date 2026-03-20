/**
 * POST /api/dashboard/settings/sync-agent
 * Force-pushes the current system_prompt + voice from Supabase to the Ultravox agent.
 * Use when you suspect Supabase and Ultravox are out of sync.
 * Auth: owner or admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id

  if (!targetClientId) return NextResponse.json({ error: 'No client_id' }, { status: 400 })

  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, ultravox_agent_id, booking_enabled, transfer_conditions, sms_enabled, knowledge_backend, corpus_id, corpus_enabled')
    .eq('id', targetClientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.ultravox_agent_id) return NextResponse.json({ error: 'No Ultravox agent configured for this client' }, { status: 422 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system prompt to sync' }, { status: 422 })

  try {
    // Pass all flags to updateAgent() — it handles tool construction for calendar,
    // transfer, SMS, knowledge, coaching, and hangUp tools centrally.
    await updateAgent(client.ultravox_agent_id, {
      systemPrompt: client.system_prompt,
      ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
      tools: [{ toolName: 'hangUp' }],
      booking_enabled: client.booking_enabled ?? false,
      slug: client.slug,
      forwarding_number: (client.forwarding_number as string | null) || undefined,
      transfer_conditions: (client.transfer_conditions as string | null) || undefined,
      sms_enabled: client.sms_enabled ?? false,
      knowledge_backend: (client.knowledge_backend as string | null) || undefined,
      corpus_id: (client.corpus_id as string | null) || undefined,
    })
    console.log(`[sync-agent] Synced client=${targetClientId} agent=${client.ultravox_agent_id}`)
    return NextResponse.json({ ok: true, agent_id: client.ultravox_agent_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sync-agent] Failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
