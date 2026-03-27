import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow, type PriorCall } from '@/lib/agent-context'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { APP_URL } from '@/lib/app-url'

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
    .order('role').limit(1).maybeSingle()

  if (!cu?.client_id) {
    return NextResponse.json({ error: 'No client linked to your account' }, { status: 403 })
  }

  // Admin override: allow testing any client's agent
  const body = await req.json().catch(() => ({}))
  let targetClientId = cu.client_id
  if (cu.role === 'admin' && body.client_id) {
    targetClientId = body.client_id
  }

  // Fetch client data — same columns buildAgentContext() needs + agent/tools fields
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, agent_name, status, ultravox_agent_id, tools, agent_voice_id, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
    .eq('id', targetClientId)
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

  // Build full context via shared buildAgentContext() — same as inbound webhook
  const clientRow: ClientRow = {
    id: client.id,
    slug: (client.slug as string) ?? 'test',
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
  const knowledgeBackend = client.knowledge_backend as string | null
  const corpusAvailable = knowledgeBackend === 'pgvector'

  // Query prior test calls so the agent recognizes returning testers
  const { data: priorData } = await svc
    .from('call_logs')
    .select('started_at, call_status, ai_summary, caller_name, ultravox_call_id')
    .in('caller_phone', ['trial-test', 'webrtc-test'])
    .eq('client_id', client.id)
    .order('started_at', { ascending: false })
    .limit(5)
  const priorCalls = (priorData ?? []) as PriorCall[]

  const ctx = buildAgentContext(clientRow, '+15555550100', priorCalls, new Date(), corpusAvailable)

  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  // Build tool overrides from clients.tools (runtime X-Tool-Secret injection)
  const overrideTools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined
  const slug = (client.slug as string) ?? ''

  // Callback URL → production completed webhook for classification, gap detection, minute tracking
  const callbackBaseUrl = `${APP_URL}/api/webhook/${slug}/completed`
  const callbackUrl = signCallbackUrl(callbackBaseUrl, slug)

  try {
    const { joinUrl, callId } = await callViaAgent(client.ultravox_agent_id as string, {
      medium: 'webrtc',
      maxDuration: '300s',
      callbackUrl,
      callerContext: callerContextRaw,
      businessFacts: knowledgeBlockStr,
      contextData: contextDataBlock,
      metadata: { slug, source: 'dashboard-agent-test', userId: user.id },
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
      businessName: (client.business_name as string) || '',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[agent-test] Failed: client=${client.slug} error=${msg}`)
    return NextResponse.json({ error: 'Failed to start test call. Please try again.' }, { status: 502 })
  }
}
