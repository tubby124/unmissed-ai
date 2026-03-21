import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callViaAgent, createCall, signCallbackUrl } from '@/lib/ultravox'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'
import { buildAgentContext, type ClientRow, type PriorCall } from '@/lib/agent-context'
import { defaultCallState } from '@/lib/call-state'
import { sendAlert } from '@/lib/telegram'
import { notifySystemFailure } from '@/lib/admin-alerts'
import { APP_URL } from '@/lib/app-url'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

export const maxDuration = 15

/**
 * POST /api/webhook/[slug]/transfer-status
 *
 * Auth: Twilio signature validation (S13m)
 *
 * Called by Twilio when a <Dial> in the transfer route completes.
 * Twilio sends standard form params including DialCallStatus.
 *
 * If the owner didn't answer (no-answer, busy, failed, canceled):
 *   → Create a new Ultravox call and return <Connect><Stream> TwiML
 *   → The AI agent resumes the conversation with the caller
 *
 * If the owner answered (completed):
 *   → Return empty <Response> — call ended normally
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Twilio sends x-www-form-urlencoded
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  // Validate Twilio signature (S13m — was completely unauthenticated before)
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/transfer-status`
  if (!validateSignature(signature, url, body)) {
    console.error(`[transfer-status] Twilio signature FAILED for slug=${slug} url=${url}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  const dialStatus = body.DialCallStatus || 'unknown'
  const callSid = body.CallSid || 'unknown'
  const callerPhone = body.From || 'unknown'

  console.log(`[transfer-status] slug=${slug} dialStatus=${dialStatus} callSid=${callSid} caller=${callerPhone}`)

  // Map Twilio dialStatus to our normalized enum
  const STATUS_MAP: Record<string, string> = {
    'completed': 'completed',
    'no-answer': 'no_answer',
    'busy': 'busy',
    'failed': 'failed',
    'canceled': 'canceled',
  }

  const supabase = createServiceClient()

  // Update transfer_status on the original call log (return id for parent FK)
  const normalizedStatus = STATUS_MAP[dialStatus] ?? 'failed'
  const { data: updatedRows, error: statusUpdateErr } = await supabase.from('call_logs')
    .update({ transfer_status: normalizedStatus, transfer_updated_at: new Date().toISOString() })
    .eq('twilio_call_sid', callSid)
    .eq('transfer_status', 'transferring')
    .select('id')
  if (statusUpdateErr) console.warn(`[transfer-status] Failed to update transfer_status: ${statusUpdateErr.message}`)
  const parentCallLogId = updatedRows?.[0]?.id as string | undefined

  // If the transfer succeeded, nothing to do — Twilio already connected the call
  if (dialStatus === 'completed') {
    console.log(`[transfer-status] Transfer succeeded for slug=${slug}, returning empty response`)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response/>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  // Transfer failed (no-answer, busy, failed, canceled) — reconnect to AI agent
  console.log(`[transfer-status] Transfer failed (${dialStatus}) for slug=${slug}, reconnecting to AI agent`)

  // Guard: max 1 reconnect per Twilio CallSid — prevent infinite loop
  // Uses parent_call_log_id FK (S10q) instead of fragile ai_summary string matching
  const { count: recoveryCount } = await supabase
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('twilio_call_sid', callSid)
    .not('parent_call_log_id', 'is', null)
  if ((recoveryCount ?? 0) > 0) {
    console.warn(`[transfer-status] Already reconnected once for callSid=${callSid}, ending call`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, no one is available right now. We have your information and will call you back shortly.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
  const { data: client } = await supabase
    .from('clients')
    .select('id, niche, business_name, system_prompt, agent_voice_id, ultravox_agent_id, tools, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, telegram_bot_token, telegram_chat_id, seconds_used_this_month, monthly_minute_limit, bonus_minutes, grace_period_end, trial_expires_at, trial_converted')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.system_prompt || !client.ultravox_agent_id) {
    console.error(`[transfer-status] Client not found or missing prompt/agentId for slug=${slug}`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not reconnect you. Please call back.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // ── S13n: Billing guards — same 3 checks as inbound route ──────────────────
  // Grace period enforcement (hard block)
  const graceEnd = client.grace_period_end as string | null
  if (graceEnd && new Date(graceEnd) < new Date()) {
    console.warn(`[transfer-status] GRACE EXPIRED: slug=${slug}, grace_period_end=${graceEnd}`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is temporarily unavailable. Please try again later.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Trial expiry guard (hard block)
  if (client.trial_expires_at && !client.trial_converted && new Date() > new Date(client.trial_expires_at as string)) {
    console.warn(`[transfer-status] TRIAL EXPIRED: slug=${slug}, trial_expires_at=${client.trial_expires_at}`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This trial has expired. Please upgrade your account to continue receiving calls.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Overage detection (soft enforcement — log + alert, don't block)
  const secondsUsed = (client.seconds_used_this_month as number | null) ?? 0
  const secondLimit = (((client.monthly_minute_limit as number | null) ?? DEFAULT_MINUTE_LIMIT) + ((client.bonus_minutes as number | null) ?? 0)) * 60
  if (secondsUsed >= secondLimit) {
    const minsUsed = Math.ceil(secondsUsed / 60)
    const minsLimit = Math.ceil(secondLimit / 60)
    console.warn(`[transfer-status] OVERAGE RECOVERY: slug=${slug} used=${minsUsed} limit=${minsLimit} min — recovery call proceeding (soft enforcement)`)
    const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (operatorToken && operatorChat) {
      sendAlert(operatorToken, operatorChat,
        `OVERAGE RECOVERY [${slug}]\nUsed: ${minsUsed}/${minsLimit} min\nCaller: ${callerPhone}\nRecovery call proceeding (soft enforcement)`
      ).catch((e) => console.error(`[transfer-status] Overage alert failed for slug=${slug}:`, e))
    }
  }

  try {
    // Build context for the resumed call
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

    // pgvector is the only active backend
    const knowledgeBackend = (client.knowledge_backend as string | null)
    const corpusAvailable = knowledgeBackend === 'pgvector'
    const ctx = buildAgentContext(clientRow, callerPhone, priorCallRows, now, corpusAvailable)

    const callerContextBlock = ctx.assembled.callerContextBlock
    const callerContextRaw = callerContextBlock.slice(1, -1)
    // Phase 4: append retrieval instruction when enabled, guarded by prompt length hard max
    let knowledgeBlockStr = ctx.knowledge.block
    if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
      const combined = knowledgeBlockStr
        ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
        : ctx.retrieval.promptInstruction
      const estimatedTotal = (client.system_prompt?.length ?? 0) + combined.length + callerContextBlock.length + (ctx.assembled.contextDataBlock?.length ?? 0) + 10
      if (estimatedTotal <= 8000) {
        knowledgeBlockStr = combined
      } else {
        console.warn(`[transfer-status] Retrieval instruction skipped for slug=${slug} — would exceed 8K prompt limit (estimated ${estimatedTotal} chars)`)
      }
    }
    const contextDataStr = ctx.assembled.contextDataBlock

    // Sign callback URL for the resumed Ultravox call
    const rawCallbackUrl = `${APP_URL}/api/webhook/${slug}/completed`
    const signedCallbackUrl = signCallbackUrl(rawCallbackUrl, slug)

    // Include transfer failure context so the agent knows to offer "take a message"
    const transferFailureNote = `TRANSFER FAILED: The caller was being transferred to the business owner but they did not answer (${dialStatus}). Resume the conversation naturally — say something like "Hey, looks like they're tied up right now. Would you like to leave a message and I'll make sure they get it?" Do NOT re-attempt the transfer.`
    const callerContextWithFailure = callerContextRaw
      ? `${callerContextRaw}\n${transferFailureNote}`
      : transferFailureNote

    const callMeta = {
      caller_phone: callerPhone,
      client_slug: slug,
      client_id: client.id,
      transfer_recovery: 'true',
    }

    const recoveryGreeting = "Hey, looks like they're tied up right now. Would you like to leave a message and I'll make sure they get it?"
    let ultravoxCall: { joinUrl: string; callId: string }

    try {
      ultravoxCall = await callViaAgent(client.ultravox_agent_id, {
        callbackUrl: signedCallbackUrl,
        metadata: callMeta,
        callerContext: callerContextWithFailure,
        firstSpeakerText: recoveryGreeting,
        ...(knowledgeBlockStr ? { businessFacts: knowledgeBlockStr } : {}),
        ...(contextDataStr ? { contextData: contextDataStr } : {}),
      })
    } catch (agentErr) {
      // Fallback to createCall if agents API fails
      console.error(`[transfer-status] Agents API failed: ${agentErr}, trying createCall`)
      let promptFull = client.system_prompt + `\n\n[${callerContextWithFailure}]`
      if (knowledgeBlockStr) promptFull += `\n\n${knowledgeBlockStr}`
      if (contextDataStr) promptFull += `\n\n${contextDataStr}`

      const tools = Array.isArray(client.tools) ? (client.tools as object[]) : undefined
      ultravoxCall = await createCall({
        systemPrompt: promptFull,
        voice: client.agent_voice_id,
        tools,
        callbackUrl: signedCallbackUrl,
        metadata: callMeta,
        languageHint: 'en',
        firstSpeakerText: recoveryGreeting,
      })
    }

    console.log(`[transfer-status] Reconnecting to Ultravox: callId=${ultravoxCall.callId} for slug=${slug}`)

    // Mark the original call as 'recovered' — AI resumed the conversation
    const { error: recoveredErr } = await supabase.from('call_logs')
      .update({ transfer_status: 'recovered', transfer_updated_at: new Date().toISOString() })
      .eq('twilio_call_sid', callSid)
      .in('transfer_status', ['no_answer', 'busy', 'failed', 'canceled'])
    if (recoveredErr) console.warn(`[transfer-status] Failed to set recovered status: ${recoveredErr.message}`)

    // Insert a new call_log row for the resumed conversation (linked to parent)
    const { error: insertErr } = await supabase.from('call_logs').insert({
      ultravox_call_id: ultravoxCall.callId,
      client_id: client.id,
      caller_phone: callerPhone,
      twilio_call_sid: callSid,
      call_status: 'live',
      started_at: new Date().toISOString(),
      ai_summary: `Transfer recovery — owner did not answer (${dialStatus})`,
      call_state: defaultCallState(client.niche as string | null),
      ...(parentCallLogId ? { parent_call_log_id: parentCallLogId } : {}),
    })
    if (insertErr) console.error(`[transfer-status] Call log insert failed: ${insertErr.message}`)

    // Alert client: transfer failed, AI recovered the call
    if (client.telegram_bot_token && client.telegram_chat_id) {
      const alertMsg = `Transfer failed (${dialStatus}) — AI agent resumed the call.\nCaller: ${callerPhone}\nBusiness: ${client.business_name || slug}`
      let sent = false
      try {
        sent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, alertMsg)
      } catch (alertErr) {
        console.error(`[transfer-status] Recovery alert failed for slug=${slug}:`, alertErr)
      }
      const { error: nlErr } = await supabase.from('notification_logs').insert({
        call_id: parentCallLogId || null,
        client_id: client.id,
        channel: 'telegram',
        recipient: client.telegram_chat_id,
        content: alertMsg.slice(0, 10000),
        status: sent ? 'sent' : 'failed',
        error: sent ? null : 'transfer recovery alert failed',
      })
      if (nlErr) console.error(`[transfer-status] notification_logs insert failed:`, nlErr.message)
    }

    // Return TwiML that reconnects the Twilio call to the new Ultravox session
    const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[transfer-status] Failed to reconnect: ${msg}`)

    // S10p: Alert admin + client that recovery failed — lost lead with zero visibility otherwise
    try {
      await notifySystemFailure(`transfer-status recovery failed for slug=${slug} caller=${callerPhone}`, err, supabase, client?.id)
    } catch (sysErr) {
      console.error(`[transfer-status] notifySystemFailure failed:`, sysErr)
    }
    if (client?.telegram_bot_token && client?.telegram_chat_id) {
      const failMsg = `MISSED LEAD: Transfer + AI recovery both failed.\nCaller: ${callerPhone}\nPlease call them back ASAP.`
      let failSent = false
      try {
        failSent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, failMsg)
      } catch (clientAlertErr) {
        console.error(`[transfer-status] Client failure alert failed:`, clientAlertErr)
      }
      const { error: nlErr2 } = await supabase.from('notification_logs').insert({
        call_id: parentCallLogId || null,
        client_id: client.id,
        channel: 'telegram',
        recipient: client.telegram_chat_id,
        content: failMsg.slice(0, 10000),
        status: failSent ? 'sent' : 'failed',
        error: failSent ? null : 'transfer recovery failure alert failed',
      })
      if (nlErr2) console.error(`[transfer-status] notification_logs insert failed:`, nlErr2.message)
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, I was unable to reconnect you. Please call back and we will follow up.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
