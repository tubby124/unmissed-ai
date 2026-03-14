import { NextRequest, NextResponse } from 'next/server'
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

  try {
    const call = await createDemoCall({
      systemPrompt: promptWithContext,
      voice: liveVoiceId || demo.voiceId,
    })

    recordUsage(ip)

    console.log(`[demo] Browser demo started: demoId=${demoId} callerName=${callerName} callId=${call.callId} ip=${ip}`)

    return NextResponse.json({
      joinUrl: call.joinUrl,
      callId: call.callId,
      agentName: demo.agentName,
      companyName: demo.companyName,
    })
  } catch (err) {
    console.error(`[demo] Failed to create demo call: ${err}`)
    return NextResponse.json(
      { error: 'Failed to start demo. Please try again.' },
      { status: 500 }
    )
  }
}
