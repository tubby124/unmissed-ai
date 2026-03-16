import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a voice agent prompt optimizer for unmissed.ai, a done-for-you AI phone agent platform. You receive a live system prompt currently powering a phone agent, plus a call intelligence brief showing real caller patterns and friction points.

Your job: suggest MINIMAL, TARGETED changes that improve call handling based on evidence from actual calls.

RULES:
- Maximum 3 changes per pass. Fewer is better. Zero is fine.
- Every change MUST cite a specific call pattern or friction point from the brief.
- NEVER rewrite the full prompt. Only insert, replace, or adjust specific lines.
- NEVER change: agent name, identity block, opening line, closing sequence, or the hangUp tool behavior.
- NEVER remove existing edge case handlers. Only add new ones or refine wording.
- Preserve exact section headers and structure.
- All new dialogue lines must sound natural when spoken aloud — use contractions, keep under 2 sentences, no jargon.

CHANGE TYPES (pick the highest-priority type that applies):
1. NEW_FAQ — callers repeatedly ask something the prompt has no handler for. Add a Q&A entry.
2. EDGE_CASE — a call derailed because of an unhandled scenario. Add a handler.
3. TONE_TWEAK — the agent's phrasing caused confusion (caller repeated themselves, asked for clarification, or got frustrated). Adjust the specific line.
4. FLOW_FIX — callers consistently provide info in a different order than expected. Adapt the flow.

ANTI-PATTERNS TO WATCH FOR:
- Agent using the client's full name where a pronoun would sound more natural
- Agent repeating information the caller already provided
- Agent asking multiple questions in one turn
- Closing sequence that sounds robotic or rushed
- Any line that would take more than 4 seconds to speak

Return ONLY valid JSON (no markdown fences):
{
  "improved_prompt": "full prompt with changes applied",
  "changes": [
    {
      "type": "new_faq | edge_case | tone_tweak | flow_fix",
      "section": "which section was modified",
      "what": "brief description",
      "why": "which call pattern or friction point motivated this",
      "confidence": "high | medium | low"
    }
  ],
  "no_changes_needed": false
}

If calls are going well and the prompt handles everything, return no_changes_needed: true with an empty changes array. Never force changes.`

type CallRow = {
  id: string
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  key_topics: string[] | null
  sentiment: string | null
  next_steps: string | null
  quality_score: number | null
  duration_seconds: number | null
}

type TranscriptRow = {
  id: string
  transcript: Array<{ role: string; text?: string }> | null
}

function extractPatterns(calls: CallRow[], frictionTranscripts: TranscriptRow[]) {
  const topicFreq: Record<string, number> = {}
  calls.forEach(c => (c.key_topics ?? []).forEach(t => {
    topicFreq[t] = (topicFreq[t] ?? 0) + 1
  }))
  const topTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const transcriptMap = Object.fromEntries(frictionTranscripts.map(r => [r.id, r.transcript ?? []]))
  const frictionCalls = calls
    .filter(c => (c.quality_score != null && c.quality_score < 6) || c.call_status === 'UNKNOWN')
    .slice(0, 5)
    .map(c => {
      const msgs = transcriptMap[c.id] ?? []
      const excerpt = msgs.slice(-6)
        .map(m => `  ${m.role}: "${(m.text || '').slice(0, 120)}"`)
        .join('\n')
      return { ...c, excerpt }
    })

  return { topTopics, frictionCalls, totalCalls: calls.length }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id

  if (!targetClientId) return NextResponse.json({ error: 'No client_id' }, { status: 400 })

  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('id, business_name, niche, system_prompt, forwarding_number')
    .eq('id', targetClientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system prompt configured yet' }, { status: 422 })

  // Build exclusion list: admin number + client's own forwarding number (if set)
  const ADMIN_NUMBERS = ['+13068507687']
  const clientOwnerPhone = client.forwarding_number
    ? [client.forwarding_number.replace(/\D/g, '').replace(/^1?(\d{10})$/, '+1$1')]
    : []
  const excludePhones = [...ADMIN_NUMBERS, ...clientOwnerPhone]
  const excludeFilter = `(${excludePhones.map(p => `"${p}"`).join(',')})`

  // Primary fetch: last 10 meaningful calls (real conversations — skip dead/short calls)
  const { data: calls } = await svc
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, key_topics, sentiment, next_steps, quality_score, duration_seconds')
    .eq('client_id', targetClientId)
    .not('call_status', 'in', '("live","processing","MISSED","JUNK")')
    .not('caller_phone', 'in', excludeFilter)
    .gt('duration_seconds', 20)
    .order('ended_at', { ascending: false })
    .limit(10)

  const callList = (calls ?? []) as CallRow[]

  // Secondary fetch: transcripts for friction calls only (max 5)
  const frictionIds = callList
    .filter(c => (c.quality_score != null && c.quality_score < 6) || c.call_status === 'UNKNOWN')
    .slice(0, 5)
    .map(c => c.id)

  const { data: frictionTranscripts } = frictionIds.length
    ? await svc.from('call_logs').select('id, transcript').in('id', frictionIds)
    : { data: [] as TranscriptRow[] }

  const { topTopics, frictionCalls, totalCalls } = extractPatterns(callList, frictionTranscripts ?? [])
  const hasEnoughData = totalCalls >= 3

  const topicLines = topTopics.length
    ? topTopics.map(([t, n]) => `  - ${t}: ${n} calls (${Math.round(n / totalCalls * 100)}%)`).join('\n')
    : '  (no topics recorded yet)'

  const frictionLines = frictionCalls.map((c, i) =>
    `Friction call ${i + 1}: status=${c.call_status} quality=${c.quality_score ?? '?'} duration=${c.duration_seconds ?? 0}s\n` +
    `  Summary: "${(c.ai_summary || 'none').slice(0, 150)}"\n` +
    (c.excerpt ? `  Dialogue excerpt (last 6 turns):\n${c.excerpt}` : '')
  ).join('\n\n')

  const callSection = totalCalls === 0
    ? 'No call data yet — review prompt quality only.'
    : `CALL INTELLIGENCE BRIEF (last ${totalCalls} calls)\n\nTOP CALLER INTENTS:\n${topicLines}\n\n` +
      (frictionCalls.length
        ? `FRICTION POINTS (quality<6 or UNKNOWN — needs prompt attention):\n${frictionLines}`
        : 'No friction calls detected — prompt handling is solid.')

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })

  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ') || 'service business'

  const userMessage = `Business: ${businessContext}

Current system prompt (preserve this structure exactly):
${client.system_prompt ?? ''}

${callSection}

Task: Based ONLY on the friction points and top topics above, add 1-2 targeted sentences to the most relevant sections of the prompt. Address specific gaps revealed by the friction calls. Do NOT rewrite, reorganize, or change anything else. Return the complete prompt with your minimal changes inline.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://unmissed.ai',
      'X-Title': 'unmissed.ai prompt improver',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: `OpenRouter error: ${res.status}` }, { status: 500 })

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || ''

  // Robust JSON extraction — Anthropic models ignore response_format on OpenRouter
  const fencedMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  const cleaned = fencedMatch
    ? fencedMatch[1].trim()
    : (() => {
        const s = raw.indexOf('{')
        const e = raw.lastIndexOf('}')
        return s !== -1 && e > s ? raw.slice(s, e + 1) : raw.trim()
      })()

  let parsed: { improved_prompt?: string; changes?: unknown[]; no_changes_needed?: boolean }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable response. Try again.' }, { status: 500 })
  }

  if (!parsed.no_changes_needed && !parsed.improved_prompt) {
    return NextResponse.json({ error: 'AI did not return an improved prompt. Try again.' }, { status: 500 })
  }

  return NextResponse.json({
    improved_prompt: parsed.improved_prompt ?? null,
    changes: parsed.changes ?? [],
    no_changes_needed: parsed.no_changes_needed ?? false,
    call_count: totalCalls,
    has_enough_data: hasEnoughData,
  })
}
