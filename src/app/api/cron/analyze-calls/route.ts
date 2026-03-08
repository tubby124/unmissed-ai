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
    .select('id, slug, business_name, niche, telegram_bot_token, telegram_chat_id')
    .eq('id', clientId)
    .single()

  if (!client) return { report_id: null, issues_count: 0, recommendations_count: 0, calls_analyzed: 0, error: 'client not found' }

  // Fetch last 50 classified calls
  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, confidence, sentiment, key_topics, next_steps, quality_score, duration_seconds, caller_phone, ended_at')
    .eq('client_id', clientId)
    .not('call_status', 'in', '("live","processing")')
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

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  // Also allow ADMIN_PASSWORD for manual dashboard trigger
  const adminPassword = process.env.ADMIN_PASSWORD
  if ((!cronSecret || token !== cronSecret) && (!adminPassword || token !== adminPassword)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const supabase = createServiceClient()

  if (body.client_id) {
    const result = await analyzeClient(body.client_id)
    return NextResponse.json({ ok: !result.error, results: [result] })
  }

  // Loop all active clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug')
    .eq('status', 'active')

  if (!clients?.length) return NextResponse.json({ ok: true, results: [], message: 'No active clients' })

  const results = await Promise.all(clients.map(c => analyzeClient(c.id)))

  return NextResponse.json({
    ok: true,
    clients_analyzed: clients.length,
    results,
  })
}
