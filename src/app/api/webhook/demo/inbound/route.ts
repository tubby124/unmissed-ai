import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createDemoCall } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'
import { DEMO_AGENTS } from '@/lib/demo-prompts'
import { APP_URL } from '@/lib/app-url'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { BRAND_NAME } from '@/lib/brand'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'

// S13o: 30 calls per 60s — same threshold as production inbound
const demoCallRateLimiter = new SlidingWindowRateLimiter(30, 60_000)

const IVR_MENU: Record<string, string> = {
  '1': 'auto_glass',
  '2': 'property_mgmt',
  '3': 'real_estate',
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const callerPhone = body.From || 'unknown'
  const digits = body.Digits || ''

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/demo/inbound`
  if (!validateSignature(signature, url, body)) {
    console.error(`[demo-ivr] Twilio signature FAILED`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // S13o: Rate limit — block floods before any Ultravox work
  const rl = demoCallRateLimiter.check('demo')
  if (!rl.allowed) {
    console.warn(`[demo-ivr] RATE LIMITED: caller=${callerPhone} retryAfter=${Math.ceil(rl.retryAfterMs / 1000)}s`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">We are experiencing unusually high call volume. Please try again later.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
  demoCallRateLimiter.record('demo')

  // No digits yet = first call in, play IVR menu
  if (!digits) {
    console.log(`[demo-ivr] New call from ${callerPhone} — playing IVR menu`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${APP_URL}/api/webhook/demo/inbound" method="POST" timeout="8">
    <Say voice="Polly.Joanna">Welcome to ${BRAND_NAME.replace('.', ' dot ')}. Press 1 to talk to an auto glass receptionist. Press 2 for a property management assistant. Press 3 for a real estate agent.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We didn't get your selection. Goodbye.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Digits received — route to demo agent
  const demoId = IVR_MENU[digits]
  if (!demoId || !DEMO_AGENTS[demoId]) {
    console.log(`[demo-ivr] Invalid digit: ${digits}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, that wasn't a valid option. Goodbye.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  const demo = DEMO_AGENTS[demoId]
  console.log(`[demo-ivr] Digit ${digits} → ${demoId} (${demo.companyName}), caller=${callerPhone}`)

  // Fetch live prompt with full context if configured (same as demo/start and demo/call-me)
  let basePrompt = demo.systemPrompt
  if (demo.useLivePrompt && demo.clientSlug) {
    try {
      const svc = createServiceClient()
      const { data: client } = await svc
        .from('clients')
        .select('id, slug, niche, business_name, system_prompt, agent_voice_id, context_data, context_data_label, business_facts, extra_qa, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, knowledge_backend, injected_note')
        .eq('slug', demo.clientSlug)
        .single()

      if (client?.system_prompt) {
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
        const ctx = buildAgentContext(clientRow, callerPhone, [], new Date(), corpusAvailable)

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

        console.log(`[demo-ivr] Using live prompt for slug=${demo.clientSlug} (${basePrompt.length} chars)`)
      }
    } catch (err) {
      console.warn(`[demo-ivr] Live prompt fetch failed for slug=${demo.clientSlug}: ${err}`)
    }
  }

  const promptWithContext = basePrompt + `\n\n[DEMO MODE — IVR PHONE. Tools: hangUp only. No SMS, transfer, or calendar on this call. CALLER PHONE: ${callerPhone}]`

  try {
    const call = await createDemoCall({
      systemPrompt: promptWithContext,
      voice: demo.voiceId,
      useTwilio: true,
    })

    console.log(`[demo:ivr] callId=${call.callId} tools=1 medium=twilio-inbound niche=${demoId} caller=${callerPhone}`)

    // Log phone demo call
    const supabase = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(callerPhone).digest('hex').slice(0, 16)
    try {
      const { error } = await supabase.from('demo_calls').insert({
        demo_id: demoId,
        caller_name: callerPhone,
        ultravox_call_id: call.callId,
        source: 'phone',
        ip_hash: ipHash,
      })
      if (error) console.error(`[demo-ivr] Failed to log demo call: ${error.message}`)
    } catch (e) {
      console.error('[demo-ivr] Demo call log threw:', e)
    }

    const twiml = buildStreamTwiml(call.joinUrl)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    console.error(`[demo-ivr] Ultravox call creation failed: ${err}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, we're experiencing technical difficulties. Please try again later or visit ${BRAND_NAME.replace('.', ' dot ')}.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
