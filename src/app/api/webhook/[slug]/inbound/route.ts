import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'
import { sendAlert } from '@/lib/telegram'
import { buildContextBlock } from '@/lib/context-data'

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
    .select('id, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, ultravox_agent_id, tools, minutes_used_this_month, monthly_minute_limit, bonus_minutes, context_data, context_data_label, business_facts, extra_qa')
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

  // ── Overage detection (soft enforcement) ────────────────────────────────────
  const minutesUsed = (client.minutes_used_this_month as number | null) ?? 0
  const minuteLimit = ((client.monthly_minute_limit as number | null) ?? 500) + ((client.bonus_minutes as number | null) ?? 0)
  const isOverLimit = minutesUsed >= minuteLimit

  if (isOverLimit) {
    console.warn(`[inbound] OVERAGE: slug=${slug} used=${minutesUsed} limit=${minuteLimit} — call proceeding (soft enforcement)`)
    const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (operatorToken && operatorChat) {
      sendAlert(operatorToken, operatorChat,
        `⚠️ <b>OVERAGE CALL</b> [${slug}]\nUsed: ${minutesUsed}/${minuteLimit} min\nCaller: ${callerPhone}\nCall proceeding (soft enforcement)`
      ).catch(() => {})
    }
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

  // ── Returning caller detection ─────────────────────────────────────────────
  // Always inject TODAY'S DATE so agent never uses a stale/wrong year for bookings
  const todayStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD UTC
  // Always inject CALLER PHONE — agent should never ask for it; we already have it from Twilio
  let callerContext = `TODAY'S DATE: ${todayStr}`
  if (callerPhone !== 'unknown') callerContext += `\nCALLER PHONE: ${callerPhone}`
  if (callerPhone !== 'unknown') {
    const { data: priorCalls } = await supabase
      .from('call_logs')
      .select('started_at, call_status, ai_summary, caller_name')
      .eq('caller_phone', callerPhone)
      .eq('client_id', client.id)
      .order('started_at', { ascending: false })
      .limit(5)

    if (priorCalls?.length) {
      const callCount = priorCalls.length
      const lastCall = priorCalls[0]
      const lastDate = new Date(lastCall.started_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
      const lastSummary = lastCall.ai_summary
        ? ` Last call: ${(lastCall.ai_summary as string).slice(0, 120)}`
        : ''
      // Inject caller name if any prior call recorded it
      const knownName = priorCalls.find(c => c.caller_name)?.caller_name as string | undefined
      if (knownName) callerContext += `\nCALLER NAME: ${knownName}`
      callerContext += `\nRETURNING CALLER — ${callCount} prior call${callCount > 1 ? 's' : ''}. Most recent: ${lastDate}.${lastSummary}`
      console.log(`[inbound] Returning caller: ${callerPhone} — ${callCount} prior calls${knownName ? `, name=${knownName}` : ''}, context injected`)
    }
  }

  // Sign callback URL with slug — pre-computable before callId is known, no async PATCH needed
  const rawCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`
  const signedCallbackUrl = signCallbackUrl(rawCallbackUrl, slug)
  const tools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined

  // ── Context data injection ────────────────────────────────────────────────
  const contextDataStr = (client.context_data as string | null)
    ? buildContextBlock(
        (client.context_data_label as string | null) || 'Reference Data',
        client.context_data as string
      )
    : ''

  // ── Business facts + extra Q&A injection ─────────────────────────────────
  const businessFactsStr = (client.business_facts as string | null)
    ? buildContextBlock('Business Facts', client.business_facts as string)
    : ''

  const extraQaRaw = (client.extra_qa as { q: string; a: string }[] | null) ?? []
  const extraQaFormatted = extraQaRaw
    .filter(p => p.q?.trim() && p.a?.trim())
    .map(p => `"${p.q}" → "${p.a}"`)
    .join('\n')
  const extraQaStr = extraQaFormatted
    ? buildContextBlock('Q&A', extraQaFormatted)
    : ''

  // ── Per-client VAD tuning ─────────────────────────────────────────────────
  // ── Create Ultravox call ───────────────────────────────────────────────────
  const callMeta = { caller_phone: callerPhone, client_slug: slug, client_id: client.id }
  const promptWithContext = callerContext
    ? client.system_prompt + `\n\n[${callerContext}]`
    : client.system_prompt
  let promptFull = promptWithContext
  if (businessFactsStr) promptFull += `\n\n${businessFactsStr}`
  if (extraQaStr)       promptFull += `\n\n${extraQaStr}`
  if (contextDataStr)   promptFull += `\n\n${contextDataStr}`

  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      // Agents API — one persistent profile per client, lightweight per-call payload
      console.log(`[inbound] Agents API: agentId=${client.ultravox_agent_id}`)
      try {
        ultravoxCall = await callViaAgent(client.ultravox_agent_id, {
          callbackUrl: signedCallbackUrl,
          metadata: callMeta,
          ...(callerContext    ? { callerContext }                    : {}),
          ...(businessFactsStr ? { businessFacts: businessFactsStr } : {}),
          ...(extraQaStr       ? { extraQa: extraQaStr }             : {}),
          ...(contextDataStr   ? { contextData: contextDataStr }     : {}),
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
      })
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[inbound] Ultravox call creation failed:', errMsg)

    // Alert operator via Telegram — missed call is revenue lost
    if (client.telegram_bot_token && client.telegram_chat_id) {
      const via = client.ultravox_agent_id ? 'Agents API' : 'createCall'
      sendAlert(
        client.telegram_bot_token,
        client.telegram_chat_id,
        `🚨 <b>CALL CREATION FAILED</b> [${slug}]\nCaller: ${callerPhone}\nMethod: ${via}\nError: ${errMsg.slice(0, 300)}`,
        client.telegram_chat_id_2 ?? undefined
      ).catch(() => {}) // fire-and-forget, already logged inside sendAlert
    }

    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="alice">Sorry, we're experiencing technical difficulties. Please try again shortly.</Say></Response>`
    return new NextResponse(fallbackTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  console.log(`[inbound] Ultravox call created: callId=${ultravoxCall.callId} joinUrl=${ultravoxCall.joinUrl.slice(0, 60)}...`)

  // Fire-and-forget: insert 'live' row
  supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: callerPhone,
    twilio_call_sid: body.CallSid || null,
    call_status: 'live',
    started_at: new Date().toISOString(),
    is_overage: isOverLimit,
  }).then(({ error }) => {
    if (error) console.error('[inbound] Live row insert failed:', error.message)
    else console.log(`[inbound] Live row inserted: callId=${ultravoxCall.callId}`)
  })

  console.log(`[inbound] Returning TwiML stream for callId=${ultravoxCall.callId}`)
  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
