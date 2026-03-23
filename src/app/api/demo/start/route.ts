import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createDemoCall, buildDemoTools, signCallbackUrl } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { DEMO_AGENTS } from '@/lib/demo-prompts'
import { OnboardingData } from '@/types/onboarding'
import { toIntakePayload } from '@/lib/intake-transform'
import { buildPromptFromIntake } from '@/lib/prompt-builder'
import { APP_URL } from '@/lib/app-url'
import { globalDemoBudget, GLOBAL_DEMO_KEY } from '@/lib/demo-budget'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { buildAgentContext, type ClientRow } from '@/lib/agent-context'

// 10 demos per IP per hour (S13x: shared limiter replaces inline Map)
const perIpLimiter = new SlidingWindowRateLimiter(10, 60 * 60 * 1000)

// Default voices for onboard preview calls
const VOICE_AISHA      = '87edb04c-06d4-47c2-bd94-683bc47e8fbe' // real estate
const VOICE_MARK       = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae' // auto glass / trades
const VOICE_JACQUELINE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a' // everything else

const NICHE_PREVIEW_VOICE: Record<string, string> = {
  real_estate: VOICE_AISHA,
  outbound_isa_realtor: VOICE_AISHA,
  auto_glass: VOICE_MARK,
  hvac: VOICE_MARK,
  plumbing: VOICE_MARK,
}

const NICHE_AGENT_NAME: Record<string, string> = {
  auto_glass: 'Mark', hvac: 'Mike', plumbing: 'Dave', dental: 'Ashley',
  legal: 'Jordan', salon: 'Jamie', real_estate: 'Alex',
  property_management: 'Alisha', outbound_isa_realtor: 'Fatima',
  voicemail: 'Sam', restaurant: 'Jamie', other: 'Sam',
}

const MALE_NICHES = new Set(['auto_glass', 'hvac', 'plumbing'])

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

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
      { error: 'Demo limit reached. You can try again in an hour, or sign up to get your own agent.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    )
  }

  const body = await req.json().catch(() => ({}))
  const callerName = (body.callerName as string)?.trim() || 'Friend'

  // ── Preview mode: generate prompt live from onboarding data ─────────────────
  if (body.mode === 'preview' && body.onboardingData) {
    const onboardingData = body.onboardingData as OnboardingData
    const niche = onboardingData.niche || 'other'
    const agentName = onboardingData.agentName || NICHE_AGENT_NAME[niche] || 'Sam'
    const companyName = onboardingData.businessName || 'Your Business'

    // Extract approved website scrape data for prompt injection
    let websiteContent = ''
    const sr = onboardingData.websiteScrapeResult
    if (sr && sr.businessFacts?.length > 0) {
      const approvedFacts = sr.businessFacts.filter((_: string, i: number) => sr.approvedFacts[i] !== false)
      const approvedQa = sr.extraQa.filter((_: { q: string; a: string }, i: number) => sr.approvedQa[i] !== false)
      const factLines = approvedFacts.map((f: string) => `- ${f}`).join('\n')
      const qaLines = approvedQa.map((qa: { q: string; a: string }) => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n')
      websiteContent = [factLines, qaLines].filter(Boolean).join('\n\n')
    }

    let prompt: string
    try {
      const intake = toIntakePayload(onboardingData)
      prompt = buildPromptFromIntake(intake as Record<string, unknown>, websiteContent || undefined)
    } catch (err) {
      return NextResponse.json({ error: `Prompt generation failed: ${err}` }, { status: 500 })
    }

    const promptWithContext = prompt + `\n\n[PREVIEW MODE — The business owner is testing their own agent before going live. Caller name: "${callerName}". 2-minute preview. Be concise.]

HANG-UP RULES (mandatory — follow exactly):
- When the caller says "bye", "goodbye", "thanks", "thank you", "okay thanks", "that's all", "I'm good", "I'm done", or any other signal they are finished — say a brief farewell (max 5 words) and invoke hangUp in the SAME response.
- If there is more than 3 seconds of silence after you have finished speaking and the exchange appears complete — say "take care!" and invoke hangUp.
- NEVER re-engage or say "hello?" after invoking hangUp. The call is over.
- NEVER generate any speech after your closing line and the hangUp tool call.`

    const voiceId = NICHE_PREVIEW_VOICE[niche] || VOICE_JACQUELINE
    const fallbackVoice = MALE_NICHES.has(niche) ? VOICE_MARK : VOICE_JACQUELINE

    try {
      let call: { joinUrl: string; callId: string }
      try {
        call = await createDemoCall({ systemPrompt: promptWithContext, voice: voiceId })
      } catch {
        call = await createDemoCall({ systemPrompt: promptWithContext, voice: fallbackVoice })
      }

      perIpLimiter.record(ip)
      globalDemoBudget.record(GLOBAL_DEMO_KEY)

      const supabaseLog = createServiceClient()
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
      try {
        const { error } = await supabaseLog.from('demo_calls').insert({
          demo_id: `preview:${niche}`,
          caller_name: callerName,
          ultravox_call_id: call.callId,
          source: 'onboard-preview',
          ip_hash: ipHash,
        })
        if (error) console.error(`[demo] Failed to log preview call: ${error.message}`)
      } catch (e) {
        console.error('[demo] Preview call log threw:', e)
      }

      console.log(`[demo] Onboard preview started: niche=${niche} company="${companyName}" callId=${call.callId}`)

      return NextResponse.json({ joinUrl: call.joinUrl, callId: call.callId, agentName, companyName })
    } catch (err) {
      console.error(`[demo] Preview call failed: ${err}`)
      return NextResponse.json({ error: 'Failed to start preview. Please try again.' }, { status: 500 })
    }
  }

  // ── Standard demo mode: DEMO_AGENTS lookup ──────────────────────────────────
  const demoId = body.demoId as string

  if (!demoId || !DEMO_AGENTS[demoId]) {
    return NextResponse.json(
      { error: 'Invalid demoId. Choose: auto_glass, property_mgmt, or real_estate' },
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
      const ctx = buildAgentContext(clientRow, '+15555550100', [], new Date(), corpusAvailable)

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

      console.log(`[demo] Using live prompt from Supabase for slug=${demo.clientSlug} (${basePrompt.length} chars)`)
    } else {
      console.warn(`[demo] Live prompt fetch failed for slug=${demo.clientSlug}, falling back to hardcoded`)
    }
    if (client?.agent_voice_id) {
      liveVoiceId = client.agent_voice_id as string
    }
  }

  const promptWithContext = basePrompt + `\n\n[DEMO MODE — BROWSER. Tools: hangUp, calendar. No SMS or transfer — browser has no phone number. Caller introduced themselves as "${callerName}".]`

  const voiceId = liveVoiceId || demo.voiceId
  const FALLBACK_MALE = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae'   // Mark voice
  const FALLBACK_FEMALE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a'  // Jacqueline voice
  const fallbackVoice = demo.voiceGender === 'male' ? FALLBACK_MALE : FALLBACK_FEMALE

  // Build tools from demo capabilities config (browser = WebRTC: no phone medium, no caller phone)
  let demoTools: object[] = []
  let demoCallbackUrl: string | undefined
  if (demo.capabilities && demo.clientSlug) {
    demoTools = buildDemoTools(demo.clientSlug, {
      hasPhoneMedium: false,    // WebRTC — no Twilio SID
      hasCallerPhone: false,    // Browser visitor — no phone number
      calendarEnabled: !!demo.capabilities.calendarEnabled,
      transferEnabled: false,   // Transfer requires Twilio SID — always false for browser
    })
    demoCallbackUrl = signCallbackUrl(`${APP_URL}/api/webhook/${demo.clientSlug}/completed`, demo.clientSlug)
    console.log(`[demo] ${demo.clientSlug} browser: injecting ${demoTools.length} tools + callbackUrl`)
  }

  try {
    let call: { joinUrl: string; callId: string }
    try {
      call = await createDemoCall({ systemPrompt: promptWithContext, voice: voiceId, tools: demoTools, callbackUrl: demoCallbackUrl })
    } catch (firstErr) {
      console.warn(`[demo] Voice ${voiceId} rejected, retrying with ${demo.voiceGender} fallback: ${firstErr}`)
      call = await createDemoCall({ systemPrompt: promptWithContext, voice: fallbackVoice, tools: demoTools, callbackUrl: demoCallbackUrl })
    }

    perIpLimiter.record(ip)
    globalDemoBudget.record(GLOBAL_DEMO_KEY)

    const supabaseLog = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
    try {
      const { error } = await supabaseLog.from('demo_calls').insert({
        demo_id: demoId,
        caller_name: callerName,
        ultravox_call_id: call.callId,
        source: 'browser',
        ip_hash: ipHash,
      })
      if (error) console.error(`[demo] Failed to log demo call: ${error.message}`)
    } catch (e) {
      console.error('[demo] Demo call log threw:', e)
    }

    console.log(`[demo:browser] callId=${call.callId} tools=${demoTools.length} medium=webrtc demoId=${demoId} callerName=${callerName}`)

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
