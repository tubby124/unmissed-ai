/**
 * POST /api/dashboard/browser-test-call
 *
 * Client-authenticated endpoint that creates an ephemeral WebRTC test call.
 * Uses createDemoCall() — no Twilio, no completed webhook, no call_logs entry.
 *
 * Body: { promptSlot: 'live' | 'draft', promptContent?: string }
 * Returns: { joinUrl, callId, promptSlot }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { createDemoCall } from '@/lib/ultravox'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'

// In-memory rate limiter: 10 browser test calls per client per day
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

function isRateLimited(clientId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(clientId) || []
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(clientId, recent)
  return recent.length >= RATE_LIMIT
}

function recordUsage(clientId: string) {
  const timestamps = rateLimitMap.get(clientId) || []
  timestamps.push(Date.now())
  rateLimitMap.set(clientId, timestamps)
}

export async function POST(req: NextRequest) {
  // ── Auth — owner or admin ──────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    promptSlot?: string
    promptContent?: string
    clientId?: string  // admin can test any client
  }

  const { promptSlot, promptContent } = body

  if (promptSlot !== 'live' && promptSlot !== 'draft') {
    return NextResponse.json({ error: 'promptSlot must be "live" or "draft"' }, { status: 400 })
  }

  // Admin can pass a clientId to test any client; owner uses their own
  const targetClientId: string | null = isAdmin
    ? (body.clientId ?? null)
    : (cu.client_id as string | null)

  if (!targetClientId) {
    return NextResponse.json({ error: 'No client associated with this account' }, { status: 400 })
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  if (isRateLimited(targetClientId)) {
    return NextResponse.json(
      { error: 'Daily test call limit reached (10/day). Try again tomorrow.' },
      { status: 429 }
    )
  }

  // ── Resolve system prompt ──────────────────────────────────────────────────
  let systemPrompt: string
  let voiceId: string | null = null

  // Fetch client config — same columns buildAgentContext() needs
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, system_prompt, agent_voice_id, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
    .eq('id', targetClientId)
    .single()

  if (promptSlot === 'live') {
    if (!client?.system_prompt) {
      return NextResponse.json({ error: 'No live prompt found for this client' }, { status: 404 })
    }
    systemPrompt = client.system_prompt
  } else {
    // draft — use promptContent from body
    if (!promptContent?.trim()) {
      return NextResponse.json({ error: 'promptContent required for draft slot' }, { status: 400 })
    }
    if (promptContent.length > 60000) {
      return NextResponse.json({ error: 'Draft prompt exceeds 60K character limit' }, { status: 400 })
    }
    systemPrompt = promptContent
  }

  voiceId = (client?.agent_voice_id as string | null) ?? null

  // ── Resolve templateContext placeholders ──────────────────────────────────
  // Use the SAME buildAgentContext() that production inbound uses — single source of truth
  // for callerContext (injected_note, hours, after-hours), knowledge summary, and contextData.
  const clientRow: ClientRow = {
    id: client?.id ?? targetClientId,
    slug: (client?.slug as string) ?? 'lab-test',
    niche: (client?.niche as string | null) ?? undefined,
    business_name: (client?.business_name as string | null) ?? undefined,
    timezone: (client?.timezone as string | null) ?? undefined,
    business_hours_weekday: (client?.business_hours_weekday as string | null) ?? undefined,
    business_hours_weekend: (client?.business_hours_weekend as string | null) ?? undefined,
    after_hours_behavior: (client?.after_hours_behavior as string | null) ?? undefined,
    after_hours_emergency_phone: (client?.after_hours_emergency_phone as string | null) ?? undefined,
    business_facts: (client?.business_facts as string | null) ?? undefined,
    extra_qa: (client?.extra_qa as { q: string; a: string }[] | null) ?? undefined,
    context_data: (client?.context_data as string | null) ?? undefined,
    context_data_label: (client?.context_data_label as string | null) ?? undefined,
    knowledge_backend: (client?.knowledge_backend as string | null) ?? undefined,
    injected_note: (client?.injected_note as string | null) ?? undefined,
  }
  const knowledgeBackend = (client?.knowledge_backend as string | null)
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, '+15555550100', [], new Date(), corpusAvailable)

  // Strip brackets from callerContextBlock — production inbound does the same for Agents API
  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  systemPrompt = systemPrompt
    .replace(/\{\{callerContext\}\}/g, callerContextRaw)
    .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
    .replace(/\{\{extraQa\}\}/g, '')
    .replace(/\{\{contextData\}\}/g, contextDataBlock)

  // ── Create ephemeral WebRTC call (no Twilio, no webhook, no call_logs) ──────
  try {
    recordUsage(targetClientId)

    const { joinUrl, callId } = await createDemoCall({
      systemPrompt,
      voice: voiceId,
      maxDuration: '180s',
      timeExceededMessage: 'Test call time limit reached. Edit the prompt and try again!',
    })

    console.log(`[lab] Browser test call started: clientId=${targetClientId} slot=${promptSlot} callId=${callId}`)

    return NextResponse.json({ joinUrl, callId, promptSlot })
  } catch (err) {
    console.error(`[lab] Failed to create browser test call: ${err}`)
    return NextResponse.json(
      { error: 'Failed to create test call', detail: String(err) },
      { status: 502 }
    )
  }
}
