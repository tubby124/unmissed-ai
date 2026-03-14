import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createDemoCall } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { DEMO_AGENTS } from '@/lib/demo-prompts'

// Simple in-memory rate limiter: 2 demos per IP per hour
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demo limit reached. You can try again in an hour, or sign up to get your own agent.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const demoId = body.demoId as string
  const callerName = (body.callerName as string)?.trim() || 'Friend'

  if (!demoId || !DEMO_AGENTS[demoId]) {
    return NextResponse.json(
      { error: 'Invalid demoId. Choose: auto_glass, property_mgmt, or voicemail' },
      { status: 400 }
    )
  }

  const demo = DEMO_AGENTS[demoId]

  // Fetch live prompt from Supabase if flagged (for testing production prompt changes)
  let basePrompt = demo.systemPrompt
  let liveVoiceId: string | null = null
  if (demo.useLivePrompt && demo.clientSlug) {
    const supabase = createServiceClient()
    const { data: client } = await supabase
      .from('clients')
      .select('system_prompt, agent_voice_id')
      .eq('slug', demo.clientSlug)
      .single()

    if (client?.system_prompt) {
      basePrompt = client.system_prompt
      console.log(`[demo] Using live prompt from Supabase for slug=${demo.clientSlug} (${basePrompt.length} chars)`)
    } else {
      console.warn(`[demo] Live prompt fetch failed for slug=${demo.clientSlug}, falling back to hardcoded`)
    }
    // Use Supabase voice if available so demo stays in sync with production
    if (client?.agent_voice_id) {
      liveVoiceId = client.agent_voice_id as string
    }
  }

  // Inject caller name into the prompt context
  const promptWithContext = basePrompt + `\n\n[DEMO MODE — caller introduced themselves as "${callerName}". This is a 2-minute demo call. Be concise and showcase the agent's capabilities.]`

  const voiceId = liveVoiceId || demo.voiceId
  // Fallback: if the voice ID is rejected by Ultravox (deleted/invalid), retry with a gender-matched default
  const FALLBACK_MALE = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae'   // Mark voice
  const FALLBACK_FEMALE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a'  // Jacqueline voice
  const fallbackVoice = demo.voiceGender === 'male' ? FALLBACK_MALE : FALLBACK_FEMALE

  try {
    let call: { joinUrl: string; callId: string }
    try {
      call = await createDemoCall({
        systemPrompt: promptWithContext,
        voice: voiceId,
      })
    } catch (firstErr) {
      console.warn(`[demo] Voice ${voiceId} rejected, retrying with ${demo.voiceGender} fallback: ${firstErr}`)
      call = await createDemoCall({
        systemPrompt: promptWithContext,
        voice: fallbackVoice,
      })
    }

    recordUsage(ip)

    // Log demo call to Supabase (fire-and-forget)
    const supabaseLog = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
    supabaseLog.from('demo_calls').insert({
      demo_id: demoId,
      caller_name: callerName,
      ultravox_call_id: call.callId,
      source: 'browser',
      ip_hash: ipHash,
    }).then(({ error }) => {
      if (error) console.error(`[demo] Failed to log demo call: ${error.message}`)
    })

    console.log(`[demo] Browser demo started: demoId=${demoId} callerName=${callerName} callId=${call.callId} ip=${ip}`)

    return NextResponse.json({
      joinUrl: call.joinUrl,
      callId: call.callId,
      agentName: demo.agentName,
      companyName: demo.companyName,
    })
  } catch (err) {
    console.error(`[demo] Failed to create demo call (both voices failed): ${err}`)
    return NextResponse.json(
      { error: 'Failed to start demo. Please try again.' },
      { status: 500 }
    )
  }
}
