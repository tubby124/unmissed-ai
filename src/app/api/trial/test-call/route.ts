/**
 * POST /api/trial/test-call
 *
 * Public endpoint — creates a WebRTC demo call for trial users on the success screen.
 * Rate limited: 5 calls/hr/IP + 3 calls/hr/clientId.
 * No auth required (trial users haven't created accounts yet).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createDemoCall } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const perIpLimiter = new SlidingWindowRateLimiter(5, 60 * 60 * 1000)
const perClientLimiter = new SlidingWindowRateLimiter(3, 60 * 60 * 1000)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'

  const ipCheck = perIpLimiter.check(ip)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many test calls. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    )
  }

  const body = await req.json().catch(() => ({}))
  const clientId = (body.clientId as string)?.trim()

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  const clientCheck = perClientLimiter.check(clientId)
  if (!clientCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many test calls for this agent. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(clientCheck.retryAfterMs / 1000)) } }
    )
  }

  const supa = createServiceClient()
  const { data: client, error: clientErr } = await supa
    .from('clients')
    .select('system_prompt, agent_voice_id, agent_name, status')
    .eq('id', clientId)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (!client.system_prompt) {
    return NextResponse.json({ error: 'Agent is still being configured' }, { status: 503 })
  }

  try {
    const { joinUrl, callId } = await createDemoCall({
      systemPrompt: client.system_prompt,
      voice: client.agent_voice_id || undefined,
      maxDuration: '180s',
    })

    return NextResponse.json({ joinUrl, callId, agentName: client.agent_name })
  } catch (err) {
    console.error('[trial/test-call] createDemoCall failed:', err)
    return NextResponse.json({ error: 'Failed to start call. Please try again.' }, { status: 502 })
  }
}
