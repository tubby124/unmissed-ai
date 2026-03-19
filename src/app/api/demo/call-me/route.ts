import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import twilio from 'twilio'
import { createDemoCall, buildDemoTools, signCallbackUrl } from '@/lib/ultravox'
import { buildStreamTwiml } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase/server'
import { DEMO_AGENTS } from '@/lib/demo-prompts'

// ── Rate limiter: 3 calls per IP per hour ───────────────────────────────────
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) || []
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, recent)
  return recent.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

// ── E.164 validation (North America) ────────────────────────────────────────
function isValidE164NA(phone: string): boolean {
  // Must be +1 followed by exactly 10 digits (no leading 0 or 1 in area code)
  return /^\+1[2-9]\d{9}$/.test(phone)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  // Rate limit check
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'You\'ve reached the demo limit (3 calls/hour). Try again later or sign up for your own agent.' },
      { status: 429 }
    )
  }

  // Parse body
  const body = await req.json().catch(() => ({}))
  const phone = (body.phone as string)?.trim() || ''
  const niche = (body.niche as string)?.trim() || 'auto_glass'

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
        .select('system_prompt, agent_voice_id')
        .eq('slug', demo.clientSlug)
        .single()

      if (client?.system_prompt) {
        basePrompt = client.system_prompt
        console.log(`[call-me] Using live prompt for slug=${demo.clientSlug}`)
      }
      if (client?.agent_voice_id) {
        voiceId = client.agent_voice_id as string
      }
    } catch {
      console.warn(`[call-me] Live prompt fetch failed for slug=${demo.clientSlug}, using hardcoded`)
    }
  }

  const promptWithContext = basePrompt + `\n\n[DEMO MODE — This is a 2-minute outbound demo call. The visitor requested a callback from the unmissed.ai website. Be concise and showcase the agent's capabilities. CALLER PHONE: ${phone}]`

  // Build tools from demo capabilities config (call-me = Twilio medium + known phone)
  let demoTools: object[] = []
  let demoCallbackUrl: string | undefined
  if (demo.capabilities && demo.clientSlug) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
    demoTools = buildDemoTools(demo.clientSlug, {
      hasPhoneMedium: true,     // Twilio outbound call
      hasCallerPhone: true,     // Phone number validated above
      calendarEnabled: !!demo.capabilities.calendarEnabled,
      transferEnabled: !!demo.capabilities.transferEnabled,
    })
    demoCallbackUrl = signCallbackUrl(`${appUrl}/api/webhook/${demo.clientSlug}/completed`, demo.clientSlug)
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

    console.log(`[call-me] Ultravox call created: callId=${uvCall.callId}`)

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

    // Record rate limit usage after successful call creation
    recordUsage(ip)

    // 4. Log to demo_calls (fire-and-forget)
    const supabase = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
    supabase.from('demo_calls').insert({
      demo_id: demo.id,
      caller_name: phone,
      ultravox_call_id: uvCall.callId,
      source: 'call-me-widget',
      ip_hash: ipHash,
    }).then(({ error }) => {
      if (error) console.error(`[call-me] Failed to log demo call: ${error.message}`)
    })

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
