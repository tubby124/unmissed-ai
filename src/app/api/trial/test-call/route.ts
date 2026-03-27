/**
 * POST /api/trial/test-call
 *
 * Public endpoint — creates a WebRTC test call for trial users on the success screen.
 * Rate limited: 5 calls/hr/IP + 3 calls/hr/clientId.
 * No auth required (trial users haven't created accounts yet).
 *
 * Uses Agents API (callViaAgent) when ultravox_agent_id exists, giving the trial user
 * real tools, full context injection, and routing through the production completed webhook
 * for classification, gap detection, transcript analysis, and minute tracking.
 * Falls back to createDemoCall() if no agent is provisioned yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { callViaAgent, createDemoCall, signCallbackUrl } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { APP_URL } from '@/lib/app-url'

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
    .select('id, slug, system_prompt, agent_voice_id, agent_name, status, niche, business_name, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, business_facts, extra_qa, context_data, context_data_label, knowledge_backend, injected_note, ultravox_agent_id, tools')
    .eq('id', clientId)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (!client.system_prompt) {
    return NextResponse.json({ error: 'Agent is still being configured' }, { status: 503 })
  }

  const slug = (client.slug as string) ?? 'trial-test'

  // Build context — same as production inbound path
  const clientRow: ClientRow = {
    id: client.id,
    slug,
    niche: (client.niche as string | null) ?? undefined,
    business_name: (client.business_name as string | null) ?? undefined,
    timezone: (client.timezone as string | null) ?? undefined,
    business_hours_weekday: (client.business_hours_weekday as string | null) ?? undefined,
    business_hours_weekend: (client.business_hours_weekend as string | null) ?? undefined,
    after_hours_behavior: (client.after_hours_behavior as string | null) ?? undefined,
    after_hours_emergency_phone: (client.after_hours_emergency_phone as string | null) ?? undefined,
    business_facts: (client.business_facts as string | null) ?? undefined,
    extra_qa: (client.extra_qa as { q: string; a: string }[] | null) ?? undefined,
    context_data: (client.context_data as string | null) ?? undefined,
    context_data_label: (client.context_data_label as string | null) ?? undefined,
    knowledge_backend: (client.knowledge_backend as string | null) ?? undefined,
    injected_note: (client.injected_note as string | null) ?? undefined,
  }
  const knowledgeBackend = (client.knowledge_backend as string | null)
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, '+15555550100', [], new Date(), corpusAvailable)

  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  try {
    // Callback URL → production completed webhook for full classification + gap detection
    const callbackBaseUrl = `${APP_URL}/api/webhook/${slug}/completed`
    const callbackUrl = signCallbackUrl(callbackBaseUrl, slug)

    let joinUrl: string
    let callId: string

    if (client.ultravox_agent_id) {
      // Agents API path — same as production inbound + dashboard agent-test
      const overrideTools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined
      const result = await callViaAgent(client.ultravox_agent_id as string, {
        medium: 'webrtc',
        maxDuration: '300s',
        callbackUrl,
        callerContext: callerContextRaw,
        businessFacts: knowledgeBlockStr,
        contextData: contextDataBlock,
        metadata: { slug, source: 'trial-test', client_id: clientId },
        overrideTools,
      })
      joinUrl = result.joinUrl
      callId = result.callId
      console.log(`[trial/test-call] Agents API: slug=${slug} callId=${callId} tools=${overrideTools?.length ?? 0}`)
    } else {
      // Fallback: no agent provisioned yet — use createDemoCall with resolved prompt
      const resolvedPrompt = (client.system_prompt as string)
        .replace(/\{\{callerContext\}\}/g, callerContextRaw)
        .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
        .replace(/\{\{extraQa\}\}/g, '')
        .replace(/\{\{contextData\}\}/g, contextDataBlock)

      const result = await createDemoCall({
        systemPrompt: resolvedPrompt,
        voice: (client.agent_voice_id as string | null) || undefined,
        maxDuration: '300s',
        callbackUrl,
      })
      joinUrl = result.joinUrl
      callId = result.callId
      console.log(`[trial/test-call] createDemoCall fallback: slug=${slug} callId=${callId}`)
    }

    // Pre-insert call_logs row — completed webhook picks this up for CAS lock
    const { error: logErr } = await supa.from('call_logs').insert({
      ultravox_call_id: callId,
      client_id: clientId,
      caller_phone: 'trial-test',
      call_status: 'trial_test',
      started_at: new Date().toISOString(),
    })
    if (logErr) console.error(`[trial/test-call] call_logs insert failed for callId=${callId}: ${logErr.message}`)

    return NextResponse.json({ joinUrl, callId, agentName: client.agent_name })
  } catch (err) {
    console.error('[trial/test-call] call creation failed:', err)
    return NextResponse.json({ error: 'Failed to start call. Please try again.' }, { status: 502 })
  }
}
