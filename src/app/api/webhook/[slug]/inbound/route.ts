import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createCall, callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { defaultCallState } from '@/lib/call-state'
import { validateSignature, buildStreamTwiml, buildVoicemailTwiml, buildIvrGatherTwiml } from '@/lib/twilio'
import { sendAlert } from '@/lib/telegram'
import { buildAgentContext, type ClientRow, type PriorCall } from '@/lib/agent-context'
import { measurePromptLength } from '@/lib/knowledge-summary'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import { APP_URL } from '@/lib/app-url'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

export const maxDuration = 15

// S13e: 30 calls per slug per 60s — 10x observed peak, catches floods
const callRateLimiter = new SlidingWindowRateLimiter(30, 60_000)

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

  // Validate Twilio signature — include query params so ?skip_ivr=1 redirects validate correctly
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const reqUrl = new URL(req.url)
  const url = `${APP_URL}/api/webhook/${slug}/inbound${reqUrl.search || ''}`
  if (!validateSignature(signature, url, body)) {
    console.error(`[inbound] Twilio signature FAILED for slug=${slug} url=${url}`)
    return new NextResponse('Forbidden', { status: 403 })
  }
  console.log(`[inbound] Twilio signature OK for slug=${slug}`)

  // S13e: Rate limit per slug — block floods before any DB/Ultravox work
  const rl = callRateLimiter.check(slug)
  if (!rl.allowed) {
    console.warn(`[inbound] RATE LIMITED: slug=${slug} callerPhone=${callerPhone} retryAfter=${Math.ceil(rl.retryAfterMs / 1000)}s`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">We are experiencing unusually high call volume. Please try again in a few minutes.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
  callRateLimiter.record(slug)

  // Fetch client — includes tools + ultravox_agent_id for Agents API
  const supabase = createServiceClient()
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, niche, business_name, system_prompt, agent_voice_id, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, ultravox_agent_id, tools, seconds_used_this_month, monthly_minute_limit, bonus_minutes, context_data, context_data_label, business_facts, extra_qa, timezone, grace_period_end, trial_expires_at, trial_converted, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, voicemail_greeting_text, voicemail_greeting_audio_url, injected_note, ivr_enabled, ivr_prompt, selected_plan, subscription_status, sms_enabled')
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

  // ── IVR pre-filter gate ────────────────────────────────────────────────────
  // For clients whose callers are voicemail-trained: plays a menu before connecting
  // to the AI agent. Press 1 → voicemail. No digit/other → connect to agent.
  // skip_ivr=1 is set by the ivr-gather route when routing caller to the agent.
  const skipIvr = reqUrl.searchParams.has('skip_ivr')
  if ((client as Record<string, unknown>).ivr_enabled && !skipIvr) {
    const ivrPrompt = ((client as Record<string, unknown>).ivr_prompt as string | null)
      || `Hi, you've reached ${client.business_name || 'us'}. Press 1 to leave a voicemail, or stay on the line and our assistant will be with you.`
    const gatherUrl = `${APP_URL}/api/webhook/${slug}/ivr-gather`
    console.log(`[inbound] IVR gate active for slug=${slug}`)
    return new NextResponse(buildIvrGatherTwiml(ivrPrompt, gatherUrl), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  console.log(`[inbound] Client found: slug=${slug} clientId=${client.id} promptLen=${client.system_prompt.length} agentId=${client.ultravox_agent_id || 'none'}`)

  // ── Minute enforcement (Phase 4.5 GAP-C — hard block when over limit) ──────
  const minuteLimit = client.monthly_minute_limit as number | null
  const bonusMinutes = (client.bonus_minutes as number | null) ?? 0
  const secondsUsed = (client.seconds_used_this_month as number | null) ?? 0
  const minutesUsed = Math.ceil(secondsUsed / 60)
  const effectiveMinuteLimit = (minuteLimit ?? 0) + bonusMinutes
  const graceEnd = client.grace_period_end as string | null
  const inGracePeriod = graceEnd && new Date(graceEnd) > new Date()

  // Hard block: when limit is set, usage exceeds it, and not in grace period
  if (minuteLimit && minuteLimit > 0 && minutesUsed >= effectiveMinuteLimit && !inGracePeriod) {
    console.warn(`[inbound] MINUTE LIMIT: slug=${slug} used=${minutesUsed}/${effectiveMinuteLimit}min — call blocked`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">We're sorry, this line has reached its monthly call limit. Please contact the business directly or try again next month.</Say></Response>`
    if (client.telegram_bot_token && client.telegram_chat_id) {
      sendAlert(
        client.telegram_bot_token as string,
        client.telegram_chat_id as string,
        `⚠️ Call blocked — minute limit reached (${minutesUsed}/${effectiveMinuteLimit} min)\nCaller: ${callerPhone}\nReload minutes in your dashboard to resume calls.`
      ).catch((e) => console.error(`[inbound] Minute limit alert failed for slug=${slug}:`, e))
    }
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
  // Track overage for call_logs (grace-period callers over limit are flagged but allowed)
  const isOverLimit = !!(minuteLimit && minuteLimit > 0 && minutesUsed >= effectiveMinuteLimit)

  // ── Grace period enforcement ──────────────────────────────────────────────
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
  try {
    const { error: staleErr, data: staleData } = await supabase.from('call_logs')
      .update({ call_status: 'MISSED', ai_summary: 'Call ended without webhook delivery' })
      .eq('client_id', client.id)
      .eq('call_status', 'live')
      .lt('started_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .select('id')
    if (staleErr) console.warn(`[inbound] Stale cleanup failed: ${staleErr.message}`)
    else if (staleData?.length) console.log(`[inbound] Cleaned ${staleData.length} stale live row(s) for client=${client.id}`)
  } catch (e) {
    console.error('[inbound] Stale cleanup threw:', e)
  }

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

  // ── VIP contacts lookup — identify priority callers for VIP greeting + owner alert flow ──
  let vipLine: string | null = null
  if (callerPhone !== 'unknown') {
    const { data: vipContact } = await supabase
      .from('client_vip_contacts')
      .select('name, relationship, notes, transfer_enabled')
      .eq('client_id', client.id)
      .eq('phone', callerPhone)
      .maybeSingle()
    if (vipContact) {
      const parts: string[] = [`VIP CALLER: ${vipContact.name}`]
      if (vipContact.relationship) parts.push(vipContact.relationship)
      if (vipContact.notes) parts.push(`Note: ${vipContact.notes}`)
      parts.push(`Transfer: ${vipContact.transfer_enabled ? 'enabled' : 'disabled'}`)
      vipLine = parts.join(' | ')
      console.log(`[inbound] VIP caller detected: slug=${slug} name=${vipContact.name}`)
    }
  }

  // ── VIP roster — inject ALL VIP names into callerContext for agent awareness ──
  let vipRoster: Array<{ name: string; relationship: string | null }> = []
  const { data: vipRosterData } = await supabase
    .from('client_vip_contacts')
    .select('name, relationship')
    .eq('client_id', client.id)
    .order('name')
  if (vipRosterData && vipRosterData.length > 0) {
    vipRoster = vipRosterData
  }

  // ── SMS opt-out check — prevents agent from verbally promising SMS to opted-out callers ──
  let smsCallerOptedOut = false
  if (client.sms_enabled && callerPhone !== 'unknown') {
    const { data: optOutRow } = await supabase
      .from('sms_opt_outs')
      .select('id')
      .eq('client_id', client.id)
      .eq('phone_number', callerPhone)
      .is('opted_back_in_at', null)
      .maybeSingle()
    smsCallerOptedOut = !!optOutRow
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
    injected_note: client.injected_note as string | null,
  }

  // Phase 4: retrieval available — pgvector is the only active backend
  const knowledgeBackend = (client.knowledge_backend as string | null)
  const corpusAvailable = knowledgeBackend === 'pgvector'
  const ctx = buildAgentContext(clientRow, callerPhone, priorCallRows, now, corpusAvailable, vipRoster)

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
  let callerContextRaw   = ctx.assembled.callerContextBlock.slice(1, -1)
  if (smsCallerOptedOut) {
    callerContextRaw += '\nSMS STATUS: Caller has opted out. Do not offer or send a text.'
  }
  if (vipLine) {
    callerContextRaw += `\n${vipLine}`
  }
  const callerContextBlock = `[${callerContextRaw}]`
  // Phase 3: use condensed knowledge summary instead of raw businessFacts + extraQa
  // Phase 4: always inject retrieval instruction when enabled — never drop it
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataStr     = ctx.assembled.contextDataBlock

  // Phase 4.5 GAP-A: Plan capability disclaimer — prevent agent from promising gated features
  const callPlan = getPlanEntitlements(
    (client.subscription_status as string | null) === 'trialing' ? 'trial' : (client.selected_plan as string | null)
  )
  const gatedCapabilities: string[] = []
  if (!callPlan.bookingEnabled) gatedCapabilities.push('appointment booking')
  if (!callPlan.transferEnabled) gatedCapabilities.push('live call transfer')
  if (!callPlan.knowledgeEnabled) gatedCapabilities.push('knowledge base lookup')
  if (gatedCapabilities.length > 0) {
    const disclaimer = `IMPORTANT: Your current plan does not include: ${gatedCapabilities.join(', ')}. Do NOT offer or promise these services. If asked, say the business can upgrade their plan to enable this feature.`
    knowledgeBlockStr = knowledgeBlockStr ? `${knowledgeBlockStr}\n\n${disclaimer}` : disclaimer
  }

  // ── Prompt length measurement (Phase 3) ────────────────────────────────────
  const promptReport = measurePromptLength(
    client.system_prompt ?? '',
    knowledgeBlockStr,
    callerContextBlock,
    contextDataStr,
  )
  if (promptReport.overHardMax) {
    console.error(`[inbound] PROMPT OVER HARD MAX for slug=${slug}: ${promptReport.totalChars} chars (max 12000). Breakdown: base=${promptReport.breakdown.basePrompt}, knowledge=${promptReport.breakdown.knowledgeSummary}, caller=${promptReport.breakdown.callerContext}, contextData=${promptReport.breakdown.contextData}`)
  } else if (promptReport.overTarget) {
    console.warn(`[inbound] Prompt over target for slug=${slug}: ${promptReport.totalChars} chars (target 6000). Breakdown: base=${promptReport.breakdown.basePrompt}, knowledge=${promptReport.breakdown.knowledgeSummary}, caller=${promptReport.breakdown.callerContext}, contextData=${promptReport.breakdown.contextData}`)
  }

  // Sign callback URL with slug — pre-computable before callId is known, no async PATCH needed
  const rawCallbackUrl = `${APP_URL}/api/webhook/${slug}/completed`
  const signedCallbackUrl = signCallbackUrl(rawCallbackUrl, slug)
  const tools = Array.isArray(client.tools) && client.tools.length > 0 ? (client.tools as object[]) : undefined

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
        const agentErrMsg = agentErr instanceof Error ? agentErr.message : String(agentErr)
        console.error(`[inbound] Agents API FAILED for slug=${slug} agentId=${client.ultravox_agent_id} toolCount=${tools?.length ?? 0} — falling back to createCall. Error: ${agentErrMsg.slice(0, 500)}`)
        ultravoxCall = await createCall({
          systemPrompt: promptFull,
          voice: client.agent_voice_id,
          tools,
          callbackUrl: signedCallbackUrl,
          metadata: callMeta,
          languageHint: 'en',
          initialState: callState as unknown as Record<string, unknown>,
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

    // S14a: Voicemail fallback — capture the lead instead of hanging up
    const recordingCallbackUrl = `${APP_URL}/api/webhook/${slug}/voicemail`
    console.log(`[inbound] Returning voicemail TwiML for slug=${slug} callerPhone=${callerPhone}`)

    // Create call_log entry for the voicemail (no Ultravox call)
    supabase.from('call_logs').insert({
      client_id: client.id,
      caller_phone: callerPhone,
      twilio_call_sid: callSid,
      call_status: 'VOICEMAIL',
      started_at: new Date().toISOString(),
      ai_summary: 'Voicemail fallback — AI agent unavailable',
    }).then(({ error: vmLogErr }) => {
      if (vmLogErr) console.error(`[inbound] Voicemail call_log insert failed:`, vmLogErr.message)
      else console.log(`[inbound] Voicemail call_log created for callSid=${callSid}`)
    })

    const vmTwiml = buildVoicemailTwiml({
      businessName: client.business_name as string | null,
      greetingText: (client as Record<string, unknown>).voicemail_greeting_text as string | null,
      audioUrl: (client as Record<string, unknown>).voicemail_greeting_audio_url as string | null,
      recordingCallbackUrl,
    })
    return new NextResponse(vmTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  console.log(`[inbound] Ultravox call created: callId=${ultravoxCall.callId} joinUrl=${ultravoxCall.joinUrl.slice(0, 60)}...`)

  // Intentionally fire-and-forget: TwiML must return immediately to avoid caller silence.
  // S9g stuck-row recovery handles DB insert failures. Do not convert to await. (S10m)
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
