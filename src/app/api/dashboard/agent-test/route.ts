import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow, type PriorCall, type ContactProfile } from '@/lib/agent-context'
import { APP_URL } from '@/lib/app-url'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 30 * 60_000

export async function POST(req: NextRequest) {
  // Auth + Phase 3 Wave B scope guard
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (!scope.ownClientId && scope.role !== 'admin') {
    return NextResponse.json({ error: 'No client linked to your account' }, { status: 403 })
  }

  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const user = scope.user
  const targetClientId = scope.targetClientId

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

  // Rate limit: 5 test calls per client per 30 min — DB-backed so it survives deploys
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count: recentCount } = await svc
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('caller_phone', 'webrtc-test')
    .gte('started_at', cutoff)
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: 'Too many test calls. Please wait before trying again.', retryAfterSeconds: 1800 },
      { status: 429, headers: { 'Retry-After': '1800' } }
    )
  }

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

  const { data: vipRosterData } = await svc
    .from('client_contacts')
    .select('name, vip_relationship')
    .eq('client_id', targetClientId)
    .eq('is_vip', true)
    .order('name')
  const vipRoster = (vipRosterData ?? []).map(v => ({ name: v.name as string, relationship: v.vip_relationship as string | null }))

  const ctx = buildAgentContext(clientRow, '+15555550100', priorCalls, new Date(), corpusAvailable, vipRoster)

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

    console.log(`[agent-test] Started WebRTC test: client=${client.slug} callId=${callId} recentCount=${recentCount ?? 0}`)

    // Track test call server-side: enables native webhook billing update + prevents false orphan warnings
    try {
      await svc.from('call_logs').insert({
        ultravox_call_id: callId,
        client_id: client.id,
        call_status: 'live',
        caller_phone: 'webrtc-test',
        started_at: new Date().toISOString(),
      })
    } catch (logErr) {
      console.error(`[agent-test] call_logs insert failed: ${logErr instanceof Error ? logErr.message : logErr}`)
    }

    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/agent-test',
        method: 'POST',
        payload: { client_id: targetClientId, ultravox_call_id: callId },
      })
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
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/agent-test',
        method: 'POST',
        payload: { client_id: targetClientId },
        status: 'error',
        errorMessage: msg,
      })
    }
    return NextResponse.json({ error: 'Failed to start test call. Please try again.' }, { status: 502 })
  }
}
