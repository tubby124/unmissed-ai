/**
 * POST /api/cron/analyze-calls
 * Auth: Bearer CRON_SECRET
 *
 * Fetches last 50 classified calls per client, sends to Claude Haiku via OpenRouter,
 * generates issues + recommendations, saves to call_analysis_reports, Telegrams admin.
 *
 * Body: { client_id?: string } — omit to loop all active clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export const maxDuration = 120

const ANALYSIS_SYSTEM_PROMPT = `You are an AI voice agent performance analyst. You will receive a batch of classified call summaries for a service business and identify patterns, issues, and specific recommendations to improve the AI agent's performance.

Return a single JSON object with this exact structure:
{
  "issues": [
    {
      "severity": "high"|"medium"|"low",
      "type": "misclassification"|"missed_info"|"tone"|"prompt_gap"|"follow_up"|"other",
      "description": "concise description of the issue pattern",
      "example_call_id": "call_id string or null",
      "frequency": "how often this appears (e.g. '3 of 10 calls')"
    }
  ],
  "recommendations": [
    {
      "title": "short action title",
      "rationale": "why this change would help",
      "change_type": "prompt"|"classification"|"follow_up"|"other",
      "priority": "high"|"medium"|"low",
      "suggested_value": "specific wording, rule, or instruction to add/change — be concrete"
    }
  ],
  "overall_quality_score": 0-100,
  "summary": "2-3 sentence executive summary of the agent performance this period"
}

Rules:
- Focus on actionable, specific improvements — not generic advice
- If classifying calls as UNKNOWN frequently, that is always a high-severity issue
- For prompt recommendations, write the exact text to add or change
- Maximum 5 issues and 5 recommendations
- Sort issues by severity (high first), recommendations by priority (high first)`

async function analyzeClient(clientId: string): Promise<{
  report_id: string | null
  issues_count: number
  recommendations_count: number
  calls_analyzed: number
  error?: string
}> {
  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, business_name, niche, telegram_bot_token, telegram_chat_id, forwarding_number')
    .eq('id', clientId)
    .single()

  if (!client) return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: 0, error: 'client not found' }

  // Build exclusion list: admin number + client's own forwarding number (if set)
  const ADMIN_NUMBERS = ['+13068507687']
  const clientOwnerPhone = client.forwarding_number
    ? [client.forwarding_number.replace(/\D/g, '').replace(/^1?(\d{10})$/, '+1$1')]
    : []
  const excludePhones = [...ADMIN_NUMBERS, ...clientOwnerPhone]
  const excludeFilter = `(${excludePhones.map(p => `"${p}"`).join(',')})`

  // Fetch last 50 classified calls (excluding admin/owner numbers)
  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, confidence, sentiment, key_topics, next_steps, quality_score, duration_seconds, caller_phone, ended_at')
    .eq('client_id', clientId)
    .not('call_status', 'in', '("live","processing")')
    .not('caller_phone', 'in', excludeFilter)
    .order('ended_at', { ascending: false })
    .limit(50)

  if (!calls?.length) return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: 0, error: 'no calls to analyze' }

  const periodStart = calls[calls.length - 1]?.ended_at
  const periodEnd = calls[0]?.ended_at

  const callSummaryText = calls.map((c, i) => {
    const topics = Array.isArray(c.key_topics) ? c.key_topics.join(', ') : 'none'
    return `Call ${i + 1} [${c.id}]: status=${c.call_status} confidence=${c.confidence ?? '?'}% sentiment=${c.sentiment ?? '?'} quality=${c.quality_score ?? '?'} duration=${c.duration_seconds ?? 0}s service=${c.service_type ?? '?'} topics=[${topics}] summary="${(c.ai_summary || 'none').slice(0, 120)}"`
  }).join('\n')

  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ') || 'service business'

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: calls.length, error: 'OPENROUTER_API_KEY not set' }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://unmissed.ai',
      'X-Title': 'unmissed.ai call analyzer',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze these ${calls.length} calls for ${businessContext}:\n\n${callSummaryText}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    console.error(`[analyze-calls] OpenRouter HTTP ${res.status}: ${body}`)
    return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: calls.length, error: `OpenRouter ${res.status}` }
  }

  const data = await res.json()
  const rawContent = data.choices?.[0]?.message?.content?.trim() || ''
  const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: { issues?: unknown[]; recommendations?: unknown[]; overall_quality_score?: number; summary?: string }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[analyze-calls] JSON parse failed:', cleaned.slice(0, 300))
    return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: calls.length, error: 'JSON parse failed' }
  }

  const { data: reportRow } = await supabase
    .from('call_analysis_reports')
    .insert({
      client_id: clientId,
      calls_analyzed: calls.length,
      period_start: periodStart,
      period_end: periodEnd,
      issues: parsed.issues || [],
      recommendations: parsed.recommendations || [],
      status: 'pending',
    })
    .select('id')
    .single()

  const issuesCount = Array.isArray(parsed.issues) ? parsed.issues.length : 0
  const recsCount = Array.isArray(parsed.recommendations) ? parsed.recommendations.length : 0

  // Telegram alert to operator
  if (client.telegram_bot_token && client.telegram_chat_id) {
    const msg = [
      `🔬 <b>New Analysis Ready — ${client.business_name || client.slug}</b>`,
      `📊 ${calls.length} calls analyzed | 🐛 ${issuesCount} issues | 💡 ${recsCount} recommendations`,
      `⭐ Quality score: ${parsed.overall_quality_score ?? '?'}/100`,
      `💬 ${(parsed.summary || '').slice(0, 200)}`,
      `\n📋 Review in dashboard → Insights`,
    ].join('\n')
    await sendAlert(client.telegram_bot_token, client.telegram_chat_id, msg)
  }

  console.log(`[analyze-calls] Done: client=${client.slug} calls=${calls.length} issues=${issuesCount} recs=${recsCount} report=${reportRow?.id}`)

  return {
    report_id: reportRow?.id || null,
    issues_count: issuesCount,
    recommendations_count: recsCount,
    calls_analyzed: calls.length,
  }
}

// ─── Learning Loop ─────────────────────────────────────────────────────────
// After analysis, check if ≥5 new meaningful calls since last prompt version.
// If so, run improve-prompt logic and send a Telegram with specific suggestions.

const IMPROVE_SYSTEM_PROMPT = `You are a voice agent prompt optimizer for unmissed.ai. You receive a live system prompt and a call intelligence brief showing real caller patterns and friction points.

Your job: suggest MINIMAL, TARGETED changes that improve call handling based on evidence from actual calls.

RULES:
- Maximum 3 changes per pass. Fewer is better. Zero is fine.
- Every change MUST cite a specific call pattern or friction point from the brief.
- NEVER rewrite the full prompt. Only insert, replace, or adjust specific lines.
- NEVER change: agent name, identity block, opening line, closing sequence, or the hangUp tool behavior.
- Preserve exact section headers and structure.
- All new dialogue lines must sound natural when spoken aloud — use contractions, keep under 2 sentences.

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

If calls are going well and the prompt handles everything, return no_changes_needed: true with an empty changes array.`

type LoopChange = { type: string; section: string; what: string; why: string; confidence: string }

async function autoImproveClient(clientId: string): Promise<void> {
  const supabase = createServiceClient()

  // Check how many new meaningful calls since last prompt version
  const { data: lastVersion } = await supabase
    .from('prompt_versions')
    .select('created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const since = lastVersion?.created_at ?? new Date(0).toISOString()

  const { count } = await supabase
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .not('call_status', 'in', '("live","processing","MISSED","JUNK")')
    .gt('duration_seconds', 20)
    .gt('ended_at', since)

  // Only run if at least 5 new meaningful calls since last improvement
  if (!count || count < 5) return

  const { data: client } = await supabase
    .from('clients')
    .select('slug, business_name, niche, system_prompt, forwarding_number, telegram_bot_token, telegram_chat_id, pending_loop_suggestion')
    .eq('id', clientId)
    .single()

  if (!client?.system_prompt || !client?.telegram_bot_token || !client?.telegram_chat_id) return

  // Skip if a suggestion was generated within the last 48hrs (prevent cron spam)
  const existing = client.pending_loop_suggestion as { generated_at?: string } | null
  if (existing?.generated_at) {
    const ageMs = Date.now() - new Date(existing.generated_at).getTime()
    if (ageMs < 48 * 60 * 60 * 1000) {
      console.log(`[learning-loop] Skipping ${client.slug} — pending suggestion < 48hrs old`)
      return
    }
  }

  const ADMIN_NUMBERS = ['+13068507687']
  const clientOwnerPhone = client.forwarding_number
    ? [client.forwarding_number.replace(/\D/g, '').replace(/^1?(\d{10})$/, '+1$1')]
    : []
  const excludePhones = [...ADMIN_NUMBERS, ...clientOwnerPhone]
  const excludeFilter = `(${excludePhones.map(p => `"${p}"`).join(',')})`

  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, key_topics, sentiment, next_steps, quality_score, duration_seconds')
    .eq('client_id', clientId)
    .not('call_status', 'in', '("live","processing","MISSED","JUNK")')
    .not('caller_phone', 'in', excludeFilter)
    .gt('duration_seconds', 20)
    .order('ended_at', { ascending: false })
    .limit(10)

  if (!calls?.length) return

  // Build topic frequency map
  const topicFreq: Record<string, number> = {}
  calls.forEach(c => ((c.key_topics as string[] | null) ?? []).forEach((t: string) => {
    topicFreq[t] = (topicFreq[t] ?? 0) + 1
  }))
  const topTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Friction calls: quality < 7 or UNKNOWN
  const frictionIds = calls
    .filter(c => (c.quality_score != null && c.quality_score < 7) || c.call_status === 'UNKNOWN')
    .slice(0, 3)
    .map((c: { id: string }) => c.id)

  const { data: frictionTranscripts } = frictionIds.length
    ? await supabase.from('call_logs').select('id, transcript').in('id', frictionIds)
    : { data: [] as Array<{ id: string; transcript: Array<{ role: string; text?: string }> | null }> }

  const transcriptMap = Object.fromEntries((frictionTranscripts ?? []).map(r => [r.id, r.transcript ?? []]))
  const frictionCalls = calls
    .filter((c: { id: string; quality_score: number | null; call_status: string | null }) => (c.quality_score != null && c.quality_score < 7) || c.call_status === 'UNKNOWN')
    .slice(0, 3)
    .map((c: { id: string; call_status: string | null; quality_score: number | null; duration_seconds: number | null; ai_summary: string | null }) => {
      const msgs: Array<{ role: string; text?: string }> = transcriptMap[c.id] ?? []
      const excerpt = msgs.slice(-6).map(m => `  ${m.role}: "${(m.text || '').slice(0, 120)}"`).join('\n')
      return { ...c, excerpt }
    })

  const totalCalls = calls.length
  const topicLines = topTopics.length
    ? topTopics.map(([t, n]) => `  - ${t}: ${n} calls (${Math.round(n / totalCalls * 100)}%)`).join('\n')
    : '  (no topics recorded yet)'

  const frictionLines = frictionCalls.map((c, i) =>
    `Friction call ${i + 1}: status=${c.call_status} quality=${c.quality_score ?? '?'} duration=${c.duration_seconds ?? 0}s\n` +
    `  Summary: "${(c.ai_summary || 'none').slice(0, 150)}"\n` +
    (c.excerpt ? `  Dialogue excerpt (last 6 turns):\n${c.excerpt}` : '')
  ).join('\n\n')

  const callSection = `CALL INTELLIGENCE BRIEF (last ${totalCalls} real conversations)\n\nTOP CALLER INTENTS:\n${topicLines}\n\n` +
    (frictionCalls.length
      ? `FRICTION POINTS (quality<7 or UNKNOWN):\n${frictionLines}`
      : 'No friction calls detected — prompt handling is solid.')

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return

  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ') || 'service business'

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://unmissed.ai',
      'X-Title': 'unmissed.ai learning loop',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: IMPROVE_SYSTEM_PROMPT },
        { role: 'user', content: `Business: ${businessContext}\n\nCurrent system prompt:\n${client.system_prompt}\n\n${callSection}\n\nTask: Based ONLY on the friction points above, suggest 1-2 minimal targeted improvements. Return the complete prompt with changes inline.` },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    console.error(`[learning-loop] OpenRouter ${res.status} for ${client.slug}`)
    return
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || ''
  const fencedMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  const cleaned = fencedMatch
    ? fencedMatch[1].trim()
    : (() => { const s = raw.indexOf('{'); const e = raw.lastIndexOf('}'); return s !== -1 && e > s ? raw.slice(s, e + 1) : raw.trim() })()

  let parsed: { improved_prompt?: string; changes?: LoopChange[]; no_changes_needed?: boolean }
  try { parsed = JSON.parse(cleaned) } catch { console.error('[learning-loop] JSON parse failed'); return }

  const changes = parsed.changes ?? []
  const changesText = changes.map((c, i) =>
    `${i + 1}. [${c.type?.toUpperCase() ?? 'CHANGE'}] ${c.section ?? ''}\n   ${c.what ?? ''}\n   Why: ${c.why ?? ''}`
  ).join('\n\n')

  // Save suggestion to DB so Test Lab / Settings can load it without re-analyzing
  if (!parsed.no_changes_needed && parsed.improved_prompt) {
    await supabase
      .from('clients')
      .update({
        pending_loop_suggestion: {
          improved_prompt: parsed.improved_prompt,
          changes,
          generated_at: new Date().toISOString(),
          calls_analyzed: count,
        },
      })
      .eq('id', clientId)
  }

  const msg = [
    `🔄 <b>Learning Loop — ${client.business_name || client.slug}</b>`,
    `📞 ${count} new conversations since last prompt update`,
    parsed.no_changes_needed
      ? '✅ Prompt is solid — no changes needed.'
      : `💡 <b>${changes.length} improvement${changes.length !== 1 ? 's' : ''} suggested:</b>\n\n${changesText}`,
    '\n→ Open dashboard → Settings to review and apply',
  ].join('\n')

  await sendAlert(client.telegram_bot_token, client.telegram_chat_id, msg)
  console.log(`[learning-loop] Done: client=${client.slug} new_calls=${count} changes=${changes.length}`)
}

// ───────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const supabase = createServiceClient()

  if (body.client_id) {
    const result = await analyzeClient(body.client_id)
    autoImproveClient(body.client_id).catch(err => console.error('[learning-loop] error:', err.message))
    return NextResponse.json({ ok: !result.error, results: [result] })
  }

  // Loop all active clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug')
    .eq('status', 'active')

  if (!clients?.length) return NextResponse.json({ ok: true, results: [], message: 'No active clients' })

  const results = await Promise.all(clients.map(c => analyzeClient(c.id)))

  // Fire learning loop for each client (non-blocking)
  clients.forEach(c => autoImproveClient(c.id).catch(err => console.error(`[learning-loop] error for ${c.slug}:`, err.message)))

  return NextResponse.json({
    ok: true,
    clients_analyzed: clients.length,
    results,
  })
}
