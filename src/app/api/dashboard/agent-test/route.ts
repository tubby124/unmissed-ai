import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { callViaAgent } from '@/lib/ultravox'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

// 5 test calls per client per 30 minutes
const rateLimiter = new SlidingWindowRateLimiter(5, 30 * 60_000)

export async function POST(req: NextRequest) {
  // Auth: Supabase session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Lookup client_users to get client_id
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu?.client_id) {
    return NextResponse.json({ error: 'No client linked to your account' }, { status: 403 })
  }

  // Fetch client data
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, ultravox_agent_id, tools, business_name, agent_name, status, slug')
    .eq('id', cu.client_id)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Only trial or active clients can test
  if (!['trial', 'active'].includes(client.status ?? '')) {
    return NextResponse.json({ error: 'Agent testing is only available for trial and active accounts' }, { status: 403 })
  }

  if (!client.ultravox_agent_id) {
    return NextResponse.json({ error: 'No agent configured yet. Complete setup first.' }, { status: 400 })
  }

  // Rate limit: 5 calls per client per 30 min
  const rlKey = `agent-test:${client.id}`
  const { allowed, remaining, retryAfterMs } = rateLimiter.check(rlKey)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many test calls. Please wait before trying again.', retryAfterSeconds: Math.ceil(retryAfterMs / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }
  rateLimiter.record(rlKey)

  // Build tool overrides from clients.tools (runtime X-Tool-Secret injection)
  const overrideTools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined

  try {
    const { joinUrl, callId } = await callViaAgent(client.ultravox_agent_id, {
      medium: 'webrtc',
      maxDuration: '300s',
      metadata: { slug: client.slug ?? '', source: 'dashboard-agent-test', userId: user.id },
      overrideTools,
    })

    console.log(`[agent-test] Started WebRTC test: client=${client.slug} callId=${callId} remaining=${remaining - 1}`)

    // Track test call server-side: enables native webhook billing update + prevents false orphan warnings
    try {
      await svc.from('call_logs').insert({
        ultravox_call_id: callId,
        client_id: client.id,
        call_status: 'test',
        caller_phone: 'webrtc-test',
        started_at: new Date().toISOString(),
      })
    } catch (logErr) {
      console.error(`[agent-test] call_logs insert failed: ${logErr instanceof Error ? logErr.message : logErr}`)
    }

    return NextResponse.json({
      joinUrl,
      callId,
      agentName: client.agent_name || client.business_name || 'Your Agent',
      businessName: client.business_name || '',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[agent-test] Failed: client=${client.slug} error=${msg}`)
    return NextResponse.json({ error: 'Failed to start test call. Please try again.' }, { status: 502 })
  }
}
