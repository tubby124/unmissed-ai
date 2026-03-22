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
import { buildContextBlock } from '@/lib/context-data'
import { buildKnowledgeSummary } from '@/lib/knowledge-summary'
import type { BusinessConfig } from '@/lib/agent-context'

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
    .single()

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

  // Fetch client config (needed by both slots)
  const { data: client } = await svc
    .from('clients')
    .select('system_prompt, agent_voice_id, context_data, context_data_label, business_facts, extra_qa')
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
  // Production (Agents API) resolves {{callerContext}}, {{businessFacts}}, {{contextData}}
  // at call time via templateContext. Lab tests must do the same — otherwise placeholders
  // appear as literal text and raw data gets double-injected.

  // Build KnowledgeSummary — same condensed layer production uses (Phase 3)
  const extraQaRaw = (client?.extra_qa as { q: string; a: string }[] | null) ?? []
  const filteredQa = extraQaRaw.filter(p => p.q?.trim() && p.a?.trim())
  const businessConfig: BusinessConfig = {
    clientId: targetClientId,
    slug: '',
    niche: 'other',
    businessName: '',
    timezone: 'America/Regina',
    hoursWeekday: null,
    hoursWeekend: null,
    afterHoursBehavior: 'take_message',
    afterHoursEmergencyPhone: null,
    businessFacts: (client?.business_facts as string | null) ?? null,
    extraQa: filteredQa,
    contextData: null,
    contextDataLabel: 'Reference Data',
  }
  const knowledge = buildKnowledgeSummary(businessConfig)

  // Context data block (NOT knowledge — structured reference data, stays full)
  const contextData = client?.context_data as string | null
  const contextDataLabel = (client?.context_data_label as string | null) || 'Reference Data'
  const contextDataBlock = contextData ? buildContextBlock(contextDataLabel, contextData) : ''

  // Resolve all 4 templateContext placeholders — matches what Agents API does at call time
  systemPrompt = systemPrompt
    .replace(/\{\{callerContext\}\}/g, 'CALLER PHONE: +15555550100 [LAB TEST]')
    .replace(/\{\{businessFacts\}\}/g, knowledge.block)
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
