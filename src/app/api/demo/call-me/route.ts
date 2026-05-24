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
  const cleanText = (value: unknown, max = 120) => String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max)
  const rawPhone = cleanText(body.phone, 32)
  const phone = rawPhone ? (normalizePhoneNA(rawPhone) || rawPhone) : ''
  const niche = cleanText(body.niche, 48) || 'auto_glass'
  const callerName = cleanText(body.callerName, 80) || 'Friend'
  const callerEmail = cleanText(body.callerEmail, 160)
  const shopName = cleanText(body.shopName, 120)
  const painPoint = cleanText(body.painPoint, 80)
  const demoVariant = cleanText(body.demoVariant, 40)

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

  if (demoVariant === 'windshield' && niche === 'auto_glass') {
    voiceId = '87edb04c-06d4-47c2-bd94-683bc47e8fbe'
    basePrompt = `[THIS IS A LIVE VOICE PHONE CALL — NOT TEXT. Speak in short, natural sentences. No bullets, markdown, or long monologues.]

You are Aisha from End Voicemail, calling because this auto-glass shop prospect requested the live demo.
Your job is to make them pleasantly surprised: personal, fast, useful, and clearly built for windshield shops.

Tone: warm, confident, human, slightly playful, never robotic. If asked if you're AI, answer plainly: "yeah, I'm the AI voice demo for End Voicemail."

Call structure:
1. Intro/onboarding: greet them by name, mention their shop if provided, and explain this will be a short two-minute auto-glass demo.
2. Triage simulation: ask them to imagine they are a windshield caller, then collect the same things a shop needs: repair vs replacement, year/make/model, damage, ADAS/lane-assist camera, urgency, insurance/cash, and callback window. Ask one question at a time.
3. Owner-summary reveal: explain the owner would get a clean lead summary with status, vehicle, urgency, and next step instead of a useless voicemail.
4. Conversion handoff: if interested, explain setup simply: they keep their number; missed, busy, and after-hours calls forward to the AI line; no porting. Mention first month free and $119/month after with 250 minutes. If they want the next step, use sendTextMessage to text them the setup link: https://endvoicemail.ai/onboard?niche=auto_glass

Rules:
- Do not collect sensitive data.
- Do not quote exact windshield pricing.
- Do not pretend a real appointment is booked.
- Keep each turn under two sentences unless they ask for details.
- If they sound busy, give the 20-second version and offer follow-up.`
  }

  const prospectContextLines = [
    '[DEMO MODE — PHONE',
    `CALLER NAME: ${callerName}`,
    `CALLER PHONE: ${phone}`,
    callerEmail ? `CALLER EMAIL: ${callerEmail}` : '',
    shopName ? `PROSPECT SHOP NAME: ${shopName}` : '',
    painPoint ? `PROSPECT PAIN POINT: ${painPoint}` : '',
    demoVariant ? `DEMO VARIANT: ${demoVariant}` : '',
    'DEMO OBJECTIVE: give a short personalized demo, then simulate an auto-glass triage, explain what the shop owner receives, and if they are interested text them the setup link.',
    'CALL FLOW STAGES: 1) intro/onboarding, 2) windshield triage simulation, 3) owner summary reveal, 4) conversion handoff via SMS setup link when requested.',
    'If this is the windshield demo, greet the prospect by name, reference their shop if provided, and make the demo feel built for auto-glass shops.',
    'Do not collect sensitive customer data. Do not quote guaranteed prices. Do not pretend a real appointment is booked.',
    'If asked how setup works: they keep their number; missed, busy, and after-hours calls forward to the AI line; no porting required.',
    'Tools: hangUp, calendar, SMS, transfer.]',
  ].filter(Boolean).join('\n')

  const promptWithContext = `${basePrompt}\n\n${prospectContextLines}`

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
