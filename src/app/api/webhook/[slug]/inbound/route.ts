import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { defaultCallState } from '@/lib/call-state'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'
import { sendAlert } from '@/lib/telegram'
import { buildAgentContext, type ClientRow, type PriorCall } from '@/lib/agent-context'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

export const maxDuration = 15

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Parse x-www-form-urlencoded body (Twilio format)
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const callerPhone = body.From || 'unknown'
  const callSid = body.CallSid || 'unknown'
  console.log(`[inbound] slug=${slug} callerPhone=${callerPhone} callSid=${callSid}`)

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/inbound`
  if (!validateSignature(signature, url, body)) {
    console.error(`[inbound] Twilio signature FAILED for slug=${slug} url=${url}`)
    return new NextResponse('Forbidden', { status: 403 })
  }
  console.log(`[inbound] Twilio signature OK for slug=${slug}`)

  // Fetch client — includes tools + ultravox_agent_id for Agents API
  const supabase = createServiceClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, niche, business_name, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, ultravox_agent_id, tools, seconds_used_this_month, monthly_minute_limit, bonus_minutes, context_data, context_data_label, business_facts, extra_qa, timezone, grace_period_end, trial_expires_at, trial_converted, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (clientError || !client) {
    console.error(`[inbound] Client not found: slug=${slug} error=${clientError?.message || 'null row'}`)
    return new NextResponse('Client not found', { status: 404 })
  }

  if (!client.system_prompt) {
    console.error(`[inbound] No system_prompt for slug=${slug} clientId=${client.id} — returning unavailable message`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, this line is temporarily unavailable. Please try again later.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  console.log(`[inbound] Client found: slug=${slug} clientId=${client.id} promptLen=${client.system_prompt.length} agentId=${client.ultravox_agent_id || 'none'}`)

  // ── Overage detection (soft enforcement — seconds-based) ─────────────────────
  const secondsUsed = (client.seconds_used_this_month as number | null) ?? 0
  const secondLimit = (((client.monthly_minute_limit as number | null) ?? DEFAULT_MINUTE_LIMIT) + ((client.bonus_minutes as number | null) ?? 0)) * 60
  const isOverLimit = secondsUsed >= secondLimit

  if (isOverLimit) {
    const minsUsed = Math.ceil(secondsUsed / 60)
    const minsLimit = Math.ceil(secondLimit / 60)
    console.warn(`[inbound] OVERAGE: slug=${slug} used=${minsUsed} limit=${minsLimit} min — call proceeding (soft enforcement)`)
    const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (operatorToken && operatorChat) {
      sendAlert(operatorToken, operatorChat,
        `⚠️ <b>OVERAGE CALL</b> [${slug}]\nUsed: ${minsUsed}/${minsLimit} min\nCaller: ${callerPhone}\nCall proceeding (soft enforcement)`
      ).catch((e) => console.error(`[inbound] Overage alert failed for slug=${slug}:`, e))
    }
  }

  // ── Grace period enforcement ──────────────────────────────────────────────
  const graceEnd = client.grace_period_end as string | null
  if (graceEnd && new Date(graceEnd) < new Date()) {
    console.warn(`[inbound] GRACE EXPIRED: slug=${slug}, grace_period_end=${graceEnd}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is temporarily unavailable. Please try again later.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // ── Trial expiry guard ───────────────────────────────────────────────────
  if (client.trial_expires_at && !client.trial_converted && new Date() > new Date(client.trial_expires_at as string)) {
    console.warn(`[inbound] TRIAL EXPIRED: slug=${slug}, trial_expires_at=${client.trial_expires_at}`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This trial has expired. Please upgrade your account to continue receiving calls.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // ── Stale live call cleanup ────────────────────────────────────────────────
  // Any 'live' row older than 15 min for this client = webhook never fired. Mark MISSED.
  supabase.from('call_logs')
    .update({ call_status: 'MISSED', ai_summary: 'Call ended without webhook delivery' })
    .eq('client_id', client.id)
    .eq('call_status', 'live')
    .lt('started_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .select('id')
    .then(({ error, data }) => {
      if (error) console.warn(`[inbound] Stale cleanup failed: ${error.message}`)
      else if (data?.length) console.log(`[inbound] Cleaned ${data.length} stale live row(s) for client=${client.id}`)
    })

  // ── Per-call context assembly (Phase 2: replaces scattered inline assembly) ──────────────
  const now = new Date()
  let priorCallRows: PriorCall[] = []
  if (callerPhone !== 'unknown') {
    const { data: priorData } = await supabase
      .from('call_logs')
      .select('started_at, call_status, ai_summary, caller_name, ultravox_call_id')
      .eq('caller_phone', callerPhone)
      .eq('client_id', client.id)
      .order('started_at', { ascending: false })
      .limit(5)
    priorCallRows = (priorData ?? []) as PriorCall[]
  }

  const clientRow: ClientRow = {
    id: client.id,
    slug,
    niche: client.niche as string | null,
    business_name: client.business_name as string | null,
    timezone: client.timezone as string | null,
    business_hours_weekday: client.business_hours_weekday as string | null,
    business_hours_weekend: client.business_hours_weekend as string | null,
    after_hours_behavior: client.after_hours_behavior as string | null,
    after_hours_emergency_phone: client.after_hours_emergency_phone as string | null,
    business_facts: client.business_facts as string | null,
    extra_qa: client.extra_qa as { q: string; a: string }[] | null,
    context_data: client.context_data as string | null,
    context_data_label: client.context_data_label as string | null,
    knowledge_backend: client.knowledge_backend as string | null,
  }

  // Phase 4: retrieval available — pgvector is the only active backend
  const knowledgeBackend = (client.knowledge_backend as string | null)
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, callerPhone, priorCallRows, now, corpusAvailable)

  if (ctx.caller.isReturningCaller) {
    console.log(
      `[inbound] Returning caller: ${callerPhone} — ${ctx.caller.priorCallCount} prior call${ctx.caller.priorCallCount > 1 ? 's' : ''}` +
      `${ctx.caller.returningCallerName ? `, name=${ctx.caller.returningCallerName}` : ''}, context injected`,
    )
  }
  if (ctx.caller.isAfterHours) {
    console.log(`[inbound] After-hours detected for slug=${slug}, behavior=${ctx.business.afterHoursBehavior}`)
  }

  // callerContextBlock = '[TODAY: ...\nCALLER PHONE: ...]'  — for createCall fallback (brackets included)
  // callerContextRaw   = 'TODAY: ...\nCALLER PHONE: ...'   — for Agents API template substitution (no brackets)
  const callerContextBlock = ctx.assembled.callerContextBlock
  const callerContextRaw   = callerContextBlock.slice(1, -1)
  const firstPriorCallId   = ctx.caller.firstPriorCallId ?? undefined
  // Phase 3: use condensed knowledge summary instead of raw businessFacts + extraQa
  // Phase 4: append retrieval instruction when enabled, guarded by prompt length hard max
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    const combined = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
    // Hard-max guard: only inject if it won't push the prompt over 8K
    const estimatedTotal = (client.system_prompt?.length ?? 0) + combined.length + callerContextBlock.length + (ctx.assembled.contextDataBlock?.length ?? 0) + 10
    if (estimatedTotal <= 8000) {
      knowledgeBlockStr = combined
    } else {
      console.warn(`[inbound] Retrieval instruction skipped for slug=${slug} — would exceed 8K prompt limit (estimated ${estimatedTotal} chars)`)
    }
  }
  const contextDataStr     = ctx.assembled.contextDataBlock

  // Sign callback URL with slug — pre-computable before callId is known, no async PATCH needed
  const rawCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`
  const signedCallbackUrl = signCallbackUrl(rawCallbackUrl, slug)
  const tools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined

  // ── Create Ultravox call ───────────────────────────────────────────────────
  const callMeta = { caller_phone: callerPhone, client_slug: slug, client_id: client.id }
  // createCall fallback: callerContextBlock already has [brackets], append directly
  let promptFull = client.system_prompt + `\n\n${callerContextBlock}`
  if (knowledgeBlockStr) promptFull += `\n\n${knowledgeBlockStr}`
  if (contextDataStr)    promptFull += `\n\n${contextDataStr}`

  // Build initialMessages for returning callers (B2a — hidden context injection)
  const initialMessages = ctx.caller.isReturningCaller ? [{
    role: 'MESSAGE_ROLE_USER',
    text: `[Context: Returning caller${ctx.caller.returningCallerName ? ` named ${ctx.caller.returningCallerName}` : ''}. ${ctx.caller.priorCallCount} prior call${ctx.caller.priorCallCount > 1 ? 's' : ''}${ctx.caller.lastCallSummary ? `. Last call: ${ctx.caller.lastCallSummary}` : ''}.]`,
    medium: 'MESSAGE_MEDIUM_TEXT',
  }] : undefined

  const callState = defaultCallState(client.niche as string | null)
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      // Agents API — one persistent profile per client, lightweight per-call payload
      console.log(`[inbound] Agents API: agentId=${client.ultravox_agent_id}`)
      try {
        ultravoxCall = await callViaAgent(client.ultravox_agent_id, {
          callbackUrl: signedCallbackUrl,
          metadata: callMeta,
          overrideTools: tools,
          ...(callerContextRaw   ? { callerContext: callerContextRaw }          : {}),
          ...(knowledgeBlockStr ? { businessFacts: knowledgeBlockStr }         : {}),
          ...(contextDataStr   ? { contextData: contextDataStr }              : {}),
          ...(initialMessages  ? { initialMessages }                          : {}),
        })
      } catch (agentErr) {
        // Safety net: Agents API failed — use Supabase prompt directly via createCall
        console.error(`[inbound] Agents API failed (${agentErr}), falling back to createCall with Supabase prompt`)
        ultravoxCall = await createCall({
          systemPrompt: promptFull,
          voice: client.agent_voice_id,
          tools,
          callbackUrl: signedCallbackUrl,
          metadata: callMeta,
          languageHint: 'en',
          initialState: callState as unknown as Record<string, unknown>,
          ...(firstPriorCallId ? { priorCallId: firstPriorCallId } : {}),
        })
        console.log(`[inbound] createCall fallback succeeded: callId=${ultravoxCall.callId}`)
      }
    } else {
      // Per-call creation — no Agents API profile set up yet
      console.log(`[inbound] Per-call creation (no agentId for slug=${slug})`)
      ultravoxCall = await createCall({
        systemPrompt: promptFull,
        voice: client.agent_voice_id,
        tools,
        callbackUrl: signedCallbackUrl,
        metadata: callMeta,
        languageHint: 'en',
        initialState: callState as unknown as Record<string, unknown>,
        ...(firstPriorCallId ? { priorCallId: firstPriorCallId } : {}),
      })
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[inbound] Ultravox call creation failed:', errMsg)

    // Alert operator via Telegram — missed call is revenue lost
    if (client.telegram_bot_token && client.telegram_chat_id) {
      const via = client.ultravox_agent_id ? 'Agents API' : 'createCall'
      try {
        await sendAlert(
          client.telegram_bot_token,
          client.telegram_chat_id,
          `🚨 <b>CALL CREATION FAILED</b> [${slug}]\nCaller: ${callerPhone}\nMethod: ${via}\nError: ${errMsg.slice(0, 300)}`,
          client.telegram_chat_id_2 ?? undefined
        )
      } catch (alertErr) {
        console.error(`[inbound] Call-creation-failure alert failed for slug=${slug}:`, alertErr)
      }
    }

    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice">Sorry, we're experiencing technical difficulties. Please try again shortly.</Say></Response>`
    return new NextResponse(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  console.log(`[inbound] Ultravox call created: callId=${ultravoxCall.callId} joinUrl=${ultravoxCall.joinUrl.slice(0, 60)}...`)

  // Fire-and-forget: insert 'live' row (B3: persist initial call state for audit)
  const initialCallState = defaultCallState(client.niche as string | null)
  supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: callerPhone,
    twilio_call_sid: body.CallSid || null,
    call_status: 'live',
    started_at: new Date().toISOString(),
    is_overage: isOverLimit,
    call_state: initialCallState,
  }).then(({ error }) => {
    if (error) console.error('[inbound] Live row insert failed:', error.message)
    else console.log(`[inbound] Live row inserted: callId=${ultravoxCall.callId}`)
  })

  console.log(`[inbound] Returning TwiML stream for callId=${ultravoxCall.callId}`)
  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
