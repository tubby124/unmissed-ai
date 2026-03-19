import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callViaAgent, createCall, signCallbackUrl } from '@/lib/ultravox'
import { buildStreamTwiml } from '@/lib/twilio'
import { buildAgentContext, type ClientRow, type PriorCall } from '@/lib/agent-context'

export const maxDuration = 15

/**
 * POST /api/webhook/[slug]/transfer-status
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

  // Update transfer_status on the original call log
  const normalizedStatus = STATUS_MAP[dialStatus] ?? 'failed'
  supabase.from('call_logs')
    .update({ transfer_status: normalizedStatus, transfer_updated_at: new Date().toISOString() })
    .eq('twilio_call_sid', callSid)
    .eq('transfer_status', 'transferring')
    .then(({ error }) => {
      if (error) console.warn(`[transfer-status] Failed to update transfer_status: ${error.message}`)
    })

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
  const { count: recoveryCount } = await supabase
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('twilio_call_sid', callSid)
    .ilike('ai_summary', 'Transfer recovery%')
  if ((recoveryCount ?? 0) > 0) {
    console.warn(`[transfer-status] Already reconnected once for callSid=${callSid}, ending call`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, no one is available right now. We have your information and will call you back shortly.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
  const { data: client } = await supabase
    .from('clients')
    .select('id, niche, business_name, system_prompt, agent_voice_id, ultravox_agent_id, tools, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, corpus_enabled, corpus_id, telegram_bot_token, telegram_chat_id')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.system_prompt || !client.ultravox_agent_id) {
    console.error(`[transfer-status] Client not found or missing prompt/agentId for slug=${slug}`)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not reconnect you. Please call back.</Say></Response>'
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
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
      corpus_enabled: client.corpus_enabled as boolean | null,
    }

    const corpusAvailable = !!(client.corpus_enabled && (client.corpus_id || process.env.ULTRAVOX_CORPUS_ID))
    const ctx = buildAgentContext(clientRow, callerPhone, priorCallRows, now, corpusAvailable)

    const callerContextBlock = ctx.assembled.callerContextBlock
    const callerContextRaw = callerContextBlock.slice(1, -1)
    const knowledgeBlockStr = ctx.knowledge.block
    const contextDataStr = ctx.assembled.contextDataBlock

    // Sign callback URL for the resumed Ultravox call
    const rawCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`
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
    supabase.from('call_logs')
      .update({ transfer_status: 'recovered', transfer_updated_at: new Date().toISOString() })
      .eq('twilio_call_sid', callSid)
      .in('transfer_status', ['no_answer', 'busy', 'failed', 'canceled'])
      .then(({ error }) => {
        if (error) console.warn(`[transfer-status] Failed to set recovered status: ${error.message}`)
      })

    // Insert a new call_log row for the resumed conversation
    supabase.from('call_logs').insert({
      ultravox_call_id: ultravoxCall.callId,
      client_id: client.id,
      caller_phone: callerPhone,
      twilio_call_sid: callSid,
      call_status: 'live',
      started_at: new Date().toISOString(),
      ai_summary: `Transfer recovery — owner did not answer (${dialStatus})`,
    }).then(({ error }) => {
      if (error) console.error(`[transfer-status] Call log insert failed: ${error.message}`)
    })

    // Return TwiML that reconnects the Twilio call to the new Ultravox session
    const twiml = buildStreamTwiml(ultravoxCall.joinUrl)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[transfer-status] Failed to reconnect: ${msg}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, I was unable to reconnect you. Please call back and we will follow up.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
