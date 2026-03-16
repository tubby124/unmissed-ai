import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getModelById, isFreeTier, estimateCost, estimateClientCost } from '@/lib/ai-models'
import { buildAdvisorSystemPrompt, type BusinessContext, type RecentCall, type CallStats, type TrendSummary, type FollowUpGapSummary, type TranscriptEntry, type ClientSetup } from '@/lib/advisor-constants'
import { computeTrends, findFollowUpGaps, formatTranscriptForPrompt, type CallRow } from '@/lib/advisor-data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    console.error('[advisor] auth failed:', authErr?.message)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { conversationId?: string; message?: string; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { message, model: modelId } = body
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message_required' }, { status: 400 })
  }
  if (!modelId || typeof modelId !== 'string') {
    return NextResponse.json({ error: 'model_required' }, { status: 400 })
  }

  const model = getModelById(modelId)
  if (!model) {
    return NextResponse.json({ error: 'invalid_model' }, { status: 400 })
  }

  const isFree = isFreeTier(model)

  // ── 3. Admin check + Credit pre-check ───────────────────────────────────
  const { data: cuRole } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const isAdmin = cuRole?.role === 'admin'

  if (!isFree && !isAdmin) {
    const { data: credits } = await supabase
      .from('ai_chat_credits')
      .select('balance_cents')
      .eq('user_id', user.id)
      .single()

    const balance = credits?.balance_cents ?? 0

    if (balance !== -1) {
      const estimatedTokens = Math.ceil(message.length / 4) + 512
      const estimatedCost = estimateClientCost(model, estimatedTokens)
      if (balance < estimatedCost) {
        return NextResponse.json(
          { error: 'insufficient_credits', balance },
          { status: 402 }
        )
      }
    }
  }

  // ── 4. Conversation (create or verify) ────────────────────────────────────
  let conversationId = body.conversationId

  if (!conversationId) {
    const title = message.slice(0, 80).trim() || 'New conversation'
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title, model: modelId })
      .select('id')
      .single()

    if (convErr || !conv) {
      console.error('[advisor] conversation create failed:', convErr?.message)
      return NextResponse.json({ error: 'conversation_create_failed' }, { status: 500 })
    }
    conversationId = conv.id
  } else {
    const { data: existing } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
    }
  }

  // ── 5. Insert user message ────────────────────────────────────────────────
  const { error: userMsgErr } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
    model: modelId,
  })

  if (userMsgErr) {
    console.error('[advisor] user message insert failed:', userMsgErr.message)
    return NextResponse.json({ error: 'message_insert_failed' }, { status: 500 })
  }

  // ── 6. Business context + client setup ───────────────────────────────────
  let businessCtx: BusinessContext | null = null
  let clientSetup: ClientSetup | null = null
  let clientId: string | null = null

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (cu?.client_id) {
    clientId = cu.client_id
    const { data: client } = await supabase
      .from('clients')
      .select('business_name, niche, slug, agent_name, services_offered, hours, business_facts, status, twilio_number, booking_enabled, forwarding_number, transfer_enabled, system_prompt')
      .eq('id', clientId)
      .single()

    if (client) {
      businessCtx = {
        businessName: client.business_name,
        niche: client.niche,
        agentName: client.agent_name,
        servicesOffered: client.services_offered,
        hours: client.hours,
        businessFacts: client.business_facts,
      }

      // Trim system_prompt to ~2000 chars for advisor context (avoids token bloat)
      const promptSummary = client.system_prompt
        ? client.system_prompt.slice(0, 2000) + (client.system_prompt.length > 2000 ? '\n[...truncated — full prompt is ' + Math.round(client.system_prompt.length / 4) + ' tokens]' : '')
        : null

      clientSetup = {
        status: client.status || 'setup',
        twilioNumber: client.twilio_number,
        niche: client.niche,
        bookingEnabled: client.booking_enabled ?? false,
        transferEnabled: client.transfer_enabled ?? false,
        forwardingNumber: client.forwarding_number,
        agentName: client.agent_name,
        userName: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        agentPromptSummary: promptSummary,
      }
    }
  }

  // ── 7. Call stats + recent calls + trends + transcripts + gaps ────────────
  let recentCalls: RecentCall[] = []
  let callStats: CallStats | null = null
  let trendSummary: TrendSummary | null = null
  let gapSummaries: FollowUpGapSummary[] = []
  let transcriptEntries: TranscriptEntry[] = []

  if (clientId) {
    // Fetch all calls for aggregate stats + trend computation (last 30 days for trends)
    const [allCallResult, recentCallResult, transcriptResult] = await Promise.all([
      supabase
        .from('call_logs')
        .select('id, call_status, duration_seconds, created_at, sentiment, quality_score, key_topics, next_steps, ai_summary, caller_phone, service_type', { count: 'exact' })
        .eq('client_id', clientId),
      supabase
        .from('call_logs')
        .select('caller_intent, call_status, summary, next_steps, created_at, duration_seconds, sentiment, quality_score, key_topics, caller_phone, service_type')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('call_logs')
        .select('call_status, created_at, ai_summary, transcript')
        .eq('client_id', clientId)
        .not('transcript', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    // Aggregate stats
    const allCallData = allCallResult.data
    const totalCalls = allCallResult.count
    if (allCallData && totalCalls !== null) {
      const statusBreakdown: Record<string, number> = {}
      let totalSeconds = 0
      let firstCall = ''
      let lastCall = ''

      for (const c of allCallData) {
        const status = c.call_status || 'UNKNOWN'
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1
        totalSeconds += c.duration_seconds || 0
        if (!firstCall || c.created_at < firstCall) firstCall = c.created_at
        if (!lastCall || c.created_at > lastCall) lastCall = c.created_at
      }

      callStats = {
        totalCalls,
        statusBreakdown,
        totalMinutes: Math.round(totalSeconds / 60),
        avgDurationSeconds: totalCalls > 0 ? Math.round(totalSeconds / totalCalls) : 0,
        dateRange: firstCall ? { first: firstCall, last: lastCall } : null,
      }

      // Compute trends + gaps from the full call data
      const callRows: CallRow[] = allCallData.map(c => ({
        ...c,
        transcript: null,
      }))

      const trends = computeTrends(callRows)
      const peakH = trends.peakHour
      const peakHourFormatted = peakH !== null
        ? (peakH === 0 ? '12 AM' : peakH < 12 ? `${peakH} AM` : peakH === 12 ? '12 PM' : `${peakH - 12} PM`)
        : null

      trendSummary = {
        thisWeekCalls: trends.thisWeek.totalCalls,
        lastWeekCalls: trends.lastWeek.totalCalls,
        callsDelta: trends.callsDelta,
        thisWeekHot: trends.thisWeek.hotLeads,
        hotLeadsDelta: trends.hotLeadsDelta,
        avgQuality: trends.thisWeek.avgQuality,
        qualityDelta: trends.qualityDelta,
        peakHour: peakHourFormatted,
        peakDay: trends.peakDay,
      }

      const gaps = findFollowUpGaps(callRows)
      gapSummaries = gaps.slice(0, 5).map(g => ({
        callerPhone: g.callerPhone,
        callStatus: g.callStatus,
        summary: g.summary,
        nextSteps: g.nextSteps,
        hoursSince: g.hoursSince,
      }))
    }

    // Recent calls for summary section
    if (recentCallResult.data) recentCalls = recentCallResult.data

    // Transcripts for deep analysis
    if (transcriptResult.data) {
      transcriptEntries = transcriptResult.data
        .filter(c => c.transcript && Array.isArray(c.transcript) && c.transcript.length > 1)
        .map(c => ({
          callDate: new Date(c.created_at).toLocaleDateString(),
          callStatus: c.call_status || 'UNKNOWN',
          summary: c.ai_summary,
          transcript: formatTranscriptForPrompt(c.transcript),
        }))
    }
  }

  // ── 8. Build messages array ───────────────────────────────────────────────
  const systemPrompt = buildAdvisorSystemPrompt(businessCtx, recentCalls, callStats, trendSummary, gapSummaries, transcriptEntries, clientSetup)

  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ]

  if (history) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // ── 9. Call OpenRouter (streaming) ────────────────────────────────────────
  const orApiKey = process.env.OPENROUTER_API_KEY
  if (!orApiKey) {
    console.error('[advisor] OPENROUTER_API_KEY not set')
    return NextResponse.json({ error: 'config_error' }, { status: 500 })
  }

  let orRes: Response
  try {
    orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${orApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai advisor',
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })
  } catch (fetchErr) {
    console.error('[advisor] OpenRouter fetch error:', fetchErr)
    return NextResponse.json({ error: 'model_unavailable' }, { status: 502 })
  }

  // ── 10. Handle OR error responses ─────────────────────────────────────────
  if (orRes.status === 429) {
    console.warn('[advisor] OpenRouter 429 rate limited for model:', model.id)
    return NextResponse.json(
      { error: 'rate_limited', suggestedModel: 'qwen/qwen-2.5-72b-instruct:free' },
      { status: 429 }
    )
  }

  if (!orRes.ok) {
    const errBody = await orRes.text().catch(() => '')
    console.error(`[advisor] OpenRouter ${orRes.status}:`, errBody)
    return NextResponse.json({ error: 'model_unavailable' }, { status: 502 })
  }

  if (!orRes.body) {
    console.error('[advisor] OpenRouter returned no body')
    return NextResponse.json({ error: 'model_unavailable' }, { status: 502 })
  }

  // ── 11. Stream SSE to client ──────────────────────────────────────────────
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let fullContent = ''
  let totalTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      const reader = orRes.body!.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
              }
              if (parsed.usage?.total_tokens) {
                totalTokens = parsed.usage.total_tokens
              }
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            } catch {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
        }
      } catch (streamErr) {
        console.error('[advisor] stream read error:', streamErr)
      } finally {
        // ── 12. Post-stream: save assistant message + deduct credits ─────
        if (!totalTokens && fullContent) {
          totalTokens = Math.ceil(fullContent.length / 4)
        }

        const costCents = isAdmin
          ? estimateCost(model, totalTokens)        // admin sees real OR cost
          : estimateClientCost(model, totalTokens)   // clients pay markup

        if (fullContent) {
          const { error: assistantErr } = await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullContent,
            model: modelId,
            tokens_used: totalTokens,
            cost_cents: costCents,
          })

          if (assistantErr) {
            console.error('[advisor] assistant message insert failed:', assistantErr.message)
          }

          await supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
        }

        if (!isFree && !isAdmin && costCents > 0) {
          const { data: deducted, error: deductErr } = await supabase.rpc(
            'deduct_advisor_credits',
            { p_user_id: user.id, p_amount_cents: costCents }
          )

          if (deductErr) {
            console.error('[advisor] credit deduction failed:', deductErr.message)
          } else if (deducted === false) {
            console.warn('[advisor] credit deduction returned false (insufficient) — message already sent')
          } else {
            console.log(`[advisor] deducted ${costCents}c from ${user.id}`)
            // Log transaction for audit trail
            await supabase.from('ai_transactions').insert({
              user_id: user.id,
              type: 'deduction',
              amount_cents: costCents,
              note: `Chat message (${modelId})`,
            })
          }
        }

        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Conversation-Id': conversationId!,
    },
  })
}
