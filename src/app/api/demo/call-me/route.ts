import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import twilio from 'twilio'
import { createDemoCall, buildDemoTools, signCallbackUrl } from '@/lib/ultravox'
import { buildStreamTwiml } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase/server'
import { DEMO_AGENTS } from '@/lib/demo-prompts'
import { APP_URL } from '@/lib/app-url'
import { globalDemoBudget, GLOBAL_DEMO_KEY } from '@/lib/demo-budget'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'
import { normalizePhoneNA } from '@/lib/utils/phone'

// 3 calls per IP per hour (S13x: shared limiter replaces inline Map)
const perIpLimiter = new SlidingWindowRateLimiter(3, 60 * 60 * 1000)

// ── E.164 validation (North America) ────────────────────────────────────────
function isValidE164NA(phone: string): boolean {
  // Must be +1 followed by exactly 10 digits (no leading 0 or 1 in area code)
  return /^\+1[2-9]\d{9}$/.test(phone)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  const globalCheck = globalDemoBudget.check(GLOBAL_DEMO_KEY)
  if (!globalCheck.allowed) {
    return NextResponse.json(
      { error: 'Demo service is temporarily at capacity. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(globalCheck.retryAfterMs / 1000)) } }
    )
  }

  const ipCheck = perIpLimiter.check(ip)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'You\'ve reached the demo limit (3 calls/hour). Try again later or sign up for your own agent.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    )
  }

  // Parse body
  const body = await req.json().catch(() => ({}))
  const rawPhone = (body.phone as string)?.trim() || ''
  const phone = rawPhone ? (normalizePhoneNA(rawPhone) || rawPhone) : ''
  const niche = (body.niche as string)?.trim() || 'auto_glass'
  const callerName = (body.callerName as string)?.trim() || 'Friend'
  const callerEmail = (body.callerEmail as string)?.trim() || ''

  // Validate phone
  if (!phone || !isValidE164NA(phone)) {
    return NextResponse.json(
      { error: 'Please enter a valid US or Canadian phone number.' },
      { status: 400 }
    )
  }

  // Pick demo agent
  const demo = DEMO_AGENTS[niche] || DEMO_AGENTS['auto_glass']

  // Fetch live prompt from Supabase if configured
  let basePrompt = demo.systemPrompt
  let voiceId = demo.voiceId
  if (demo.useLivePrompt && demo.clientSlug) {
    try {
      const supabase = createServiceClient()
      const { data: client } = await supabase
        .from('clients')
        .select('id, slug, niche, business_name, system_prompt, agent_voice_id, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
        .eq('slug', demo.clientSlug)
        .single()

      if (client?.system_prompt) {
        // Resolve {{templateContext}} placeholders — live prompts have these from Agents API
        const clientRow: ClientRow = {
          id: client.id,
          slug: client.slug as string,
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
        const ctx = buildAgentContext(clientRow, phone, [], new Date(), corpusAvailable)

        const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
        let knowledgeBlockStr = ctx.knowledge.block
        if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
          knowledgeBlockStr = knowledgeBlockStr
            ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
            : ctx.retrieval.promptInstruction
        }
        const contextDataBlock = ctx.assembled.contextDataBlock

        basePrompt = client.system_prompt
          .replace(/\{\{callerContext\}\}/g, callerContextRaw)
          .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
          .replace(/\{\{extraQa\}\}/g, '')
          .replace(/\{\{contextData\}\}/g, contextDataBlock)

        console.log(`[call-me] Using live prompt for slug=${demo.clientSlug}`)
      }
      if (client?.agent_voice_id) {
        voiceId = client.agent_voice_id as string
      }
    } catch {
      console.warn(`[call-me] Live prompt fetch failed for slug=${demo.clientSlug}, using hardcoded`)
    }
  }

  const promptWithContext = basePrompt + `\n\n[DEMO MODE — PHONE\nCALLER NAME: ${callerName}\nCALLER PHONE: ${phone}\n${callerEmail ? `CALLER EMAIL: ${callerEmail}\n` : ''}Outbound demo — visitor requested callback. Tools: hangUp, calendar, SMS, transfer.]`

  // Build tools from demo capabilities config (call-me = Twilio medium + known phone)
  let demoTools: object[] = []
  let demoCallbackUrl: string | undefined
  if (demo.capabilities && demo.clientSlug) {
    demoTools = buildDemoTools(demo.clientSlug, {
      hasPhoneMedium: true,     // Twilio outbound call
      hasCallerPhone: true,     // Phone number validated above
      calendarEnabled: !!demo.capabilities.calendarEnabled,
      transferEnabled: !!demo.capabilities.transferEnabled,
    })
    demoCallbackUrl = signCallbackUrl(`${APP_URL}/api/webhook/${demo.clientSlug}/completed`, demo.clientSlug)
    console.log(`[call-me] ${demo.clientSlug}: injecting ${demoTools.length} tools + callbackUrl`)
  }

  try {
    // 1. Create Ultravox call with Twilio medium
    const uvCall = await createDemoCall({
      systemPrompt: promptWithContext,
      voice: voiceId,
      useTwilio: true,
      tools: demoTools,
      callbackUrl: demoCallbackUrl,
    })

    console.log(`[demo:call-me] callId=${uvCall.callId} tools=${demoTools.length} medium=twilio-outbound phone=${phone}`)

    // 2. Build TwiML that connects the phone call to the Ultravox stream
    const twiml = buildStreamTwiml(uvCall.joinUrl)

    // 3. Create outbound Twilio call to the visitor's phone
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    const demoNumber = process.env.DEMO_TWILIO_NUMBER
      || process.env.NEXT_PUBLIC_DEMO_TWILIO_NUMBER
      || process.env.TWILIO_DEMO_NUMBER

    if (!demoNumber) {
      console.error('[call-me] No demo Twilio number configured (DEMO_TWILIO_NUMBER)')
      return NextResponse.json(
        { error: 'Demo calling is not configured. Please try the browser demo instead.' },
        { status: 503 }
      )
    }

    const call = await twilioClient.calls.create({
      to: phone,
      from: demoNumber,
      twiml,
    })

    console.log(`[call-me] Twilio outbound call created: sid=${call.sid} to=${phone}`)

    perIpLimiter.record(ip)
    globalDemoBudget.record(GLOBAL_DEMO_KEY)

    // 4. Log to demo_calls
    const supabase = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
    try {
      const { error } = await supabase.from('demo_calls').insert({
        demo_id: demo.id,
        caller_name: callerName,
        caller_phone: phone || null,
        caller_email: callerEmail || null,
        ultravox_call_id: uvCall.callId,
        source: 'call-me-widget',
        ip_hash: ipHash,
      })
      if (error) console.error(`[call-me] Failed to log demo call: ${error.message}`)
    } catch (e) {
      console.error('[call-me] Demo call log threw:', e)
    }

    return NextResponse.json({
      success: true,
      callSid: call.sid,
    })
  } catch (err) {
    console.error(`[call-me] Failed to create outbound demo call: ${err}`)
    return NextResponse.json(
      { error: 'Failed to place the call. Please try again or use the browser demo.' },
      { status: 500 }
    )
  }
}
