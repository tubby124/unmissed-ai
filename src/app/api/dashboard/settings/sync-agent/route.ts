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
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, ultravox_agent_id, booking_enabled')
    .eq('id', targetClientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.ultravox_agent_id) return NextResponse.json({ error: 'No Ultravox agent configured for this client' }, { status: 422 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system prompt to sync' }, { status: 422 })

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const transferTool = {
      temporaryTool: {
        modelToolName: 'transferCall',
        description: 'Transfer the current call to a human agent when the caller requests it or in an emergency.',
        dynamicParameters: [
          { name: 'reason', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Reason for transfer' }, required: false },
        ],
        automaticParameters: [
          { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
        ],
        http: {
          baseUrlPattern: `${appUrl}/api/webhook/${client.slug}/transfer`,
          httpMethod: 'POST',
          staticHeaders: { 'X-Transfer-Secret': process.env.WEBHOOK_SIGNING_SECRET ?? '' },
        },
      },
    }
    const tools = client.forwarding_number
      ? [{ toolName: 'hangUp' }, transferTool]
      : [{ toolName: 'hangUp' }]
    await updateAgent(client.ultravox_agent_id, {
      systemPrompt: client.system_prompt,
      ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
      tools,
      booking_enabled: client.booking_enabled ?? false,
      slug: client.slug,
    })
    console.log(`[sync-agent] Synced client=${targetClientId} agent=${client.ultravox_agent_id}`)
    return NextResponse.json({ ok: true, agent_id: client.ultravox_agent_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sync-agent] Failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
