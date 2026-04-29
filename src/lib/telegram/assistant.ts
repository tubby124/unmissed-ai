import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallRow } from './queries'
import { fetchLastNCalls, type TelegramClientRow } from './queries'
import type { AssistantIntent } from './types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4-5'
const TIMEOUT_MS = 15_000
const MAX_TOKENS = 600
const MAX_BUSINESS_FACTS = 2_000
const MAX_EXTRA_QA = 1_000
const RECENT_CALLS_N = 20
const SUMMARY_TRUNC = 120

export type AssistantOutcome = 'ok' | 'timeout' | 'fallback' | 'error'

export interface AssistantResult {
  reply: string
  outcome: AssistantOutcome
  intent: AssistantIntent
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n)
}

function formatExtraQa(extra: unknown): string {
  if (!extra) return ''
  if (typeof extra === 'string') return truncate(extra, MAX_EXTRA_QA)
  if (Array.isArray(extra)) {
    const lines: string[] = []
    for (const item of extra) {
      if (item && typeof item === 'object') {
        const q = String((item as { question?: unknown }).question ?? (item as { q?: unknown }).q ?? '').trim()
        const a = String((item as { answer?: unknown }).answer ?? (item as { a?: unknown }).a ?? '').trim()
        if (q && a) lines.push(`Q: ${q}\nA: ${a}`)
      }
    }
    return truncate(lines.join('\n\n'), MAX_EXTRA_QA)
  }
  try {
    return truncate(JSON.stringify(extra), MAX_EXTRA_QA)
  } catch {
    return ''
  }
}

function renderRecentCallsBlock(rows: CallRow[]): string {
  if (rows.length === 0) return '(no calls yet)'
  const lines = rows.slice(0, RECENT_CALLS_N).map((r) => {
    const summary = truncate(r.ai_summary ?? '', SUMMARY_TRUNC).replace(/\n/g, ' ')
    return [
      `id=${r.id}`,
      `started_at=${r.started_at ?? '—'}`,
      `caller_phone=${r.caller_phone ?? '—'}`,
      `caller_name=${r.caller_name ?? '—'}`,
      `call_status=${r.call_status ?? '—'}`,
      `lead_status=${r.lead_status ?? '—'}`,
      `service_type=${r.service_type ?? '—'}`,
      `duration_seconds=${r.duration_seconds ?? 0}`,
      `summary="${summary}"`,
    ].join('  ')
  })
  return lines.join('\n')
}

export function buildSystemPrompt(
  client: TelegramClientRow,
  recentCalls: CallRow[],
  timezone: string
): string {
  const businessName = client.business_name ?? 'your business'
  const limit = client.monthly_minute_limit ?? 0
  const bonus = client.bonus_minutes ?? 0
  const total = limit + bonus
  const usedMinutes = Math.ceil((client.seconds_used_this_month ?? 0) / 60)
  const remaining = Math.max(0, total - usedMinutes)
  const facts = truncate(client.business_facts ?? '', MAX_BUSINESS_FACTS)
  const qa = formatExtraQa(client.extra_qa)

  return [
    `You are the unmissed.ai assistant texting ${businessName} the owner via Telegram.`,
    `You answer ONLY from the data blocks below. Never invent a caller, time, phone,`,
    `call ID, balance, or limit. If the data does not contain the answer, reply`,
    `"I don't have that yet — try /calls or /missed" and stop.`,
    '',
    '# OUTPUT RULES',
    '- HTML only. Allowed tags: <b>, <i>, <code>, <pre>, <a href>. No markdown.',
    '- Default 3 lines or fewer. If listing 3+ rows, render as <pre>...</pre> table',
    '  with the same column order Tier 1 uses: emoji  HH:MM  phone  name  service.',
    '- Every row must cite real fields from RECENT_CALLS. Cite phones formatted',
    '  exactly as shown; never re-format or invent area codes.',
    '- Never include recording URLs (they expire — owners hit dead links next morning).',
    '- For minutes/balance/usage questions, the available total is',
    '  monthly_minute_limit + bonus_minutes. Always quote the COMBINED total.',
    '  Never quote monthly_minute_limit alone.',
    '- For "anything urgent?" / triage questions, define urgent =',
    "  call_status in (HOT, WARM) AND (lead_status IS NULL OR lead_status='new').",
    '  No urgent rows -> reply honestly that nothing is open.',
    '- Conversational greetings (yo, hey, sup) -> friendly 1-line ack + suggest a tap.',
    '',
    '# DATA — RECENT_CALLS (last 20, newest first)',
    renderRecentCallsBlock(recentCalls),
    '',
    '# DATA — BUSINESS_FACTS (max 2KB)',
    facts || '(none)',
    '',
    '# DATA — EXTRA_QA (max 1KB)',
    qa || '(none)',
    '',
    '# DATA — USAGE',
    `business_name=${businessName}  monthly_minute_limit=${limit}  bonus_minutes=${bonus}`,
    `combined_total=${total}  used_minutes=${usedMinutes}  remaining=${remaining}  timezone=${timezone}`,
    '',
    '# CITATION RULE',
    'If the answer references a specific call, name the caller as shown and the',
    'HH:MM in their timezone. Never paste an ID outside <code> tags.',
  ].join('\n')
}

export function inferIntent(message: string): AssistantIntent {
  const m = message.toLowerCase()
  if (/\b(urgent|emergency|hot|priority|important|callback|call back)\b/.test(m)) return 'urgent'
  if (/\b(today|tomorrow|schedule|this week|when|book(ed|ing)?|appointment)\b/.test(m)) return 'schedule'
  if (/\b(minute|minutes|balance|usage|used|left|remaining|quota|limit|bill(ing)?)\b/.test(m)) return 'minutes'
  if (/\b(price|policy|hour|service|location|address|do you|what is|who)\b/.test(m)) return 'knowledge'
  return 'generic'
}

/**
 * Citation guard — if the model invents a phone number or call_id that is
 * NOT present in recentCalls, swap to the safe fallback. Treats short phone
 * substrings (≥10 digits) and call IDs as the citation surface; business_facts
 * may legitimately mention other numbers, so we only check against call data.
 */
export function citationGuardOk(reply: string, recentCalls: CallRow[]): boolean {
  const knownDigits = new Set<string>()
  const knownIds = new Set<string>()
  for (const r of recentCalls) {
    if (r.caller_phone) knownDigits.add(r.caller_phone.replace(/\D/g, ''))
    if (r.id) knownIds.add(r.id)
  }
  const phoneMatches = reply.match(/\d[\d\s().-]{8,}\d/g) ?? []
  for (const m of phoneMatches) {
    const d = m.replace(/\D/g, '')
    if (d.length < 10) continue
    let hit = false
    for (const k of knownDigits) {
      if (k.includes(d.slice(-10)) || d.includes(k.slice(-10))) { hit = true; break }
    }
    if (!hit) return false
  }
  // call_id citations — UUID-style only. Skip generic numbers.
  const idMatches = reply.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g) ?? []
  for (const id of idMatches) {
    if (!knownIds.has(id)) return false
  }
  return true
}

export const FALLBACK_REPLY = "I don't have that yet — try /calls or /missed."

export interface AnswerOptions {
  supa: SupabaseClient
  timezone: string
  fetchImpl?: typeof fetch // injectable for tests
  apiKey?: string // injectable for tests; defaults to process.env.OPENROUTER_API_KEY
}

export async function answerForClient(
  client: TelegramClientRow,
  message: string,
  opts: AnswerOptions
): Promise<AssistantResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? ''
  const intent = inferIntent(message)
  const start = Date.now()

  if (!apiKey) {
    return {
      reply: 'The assistant is not configured yet — Tier 1 commands still work.',
      outcome: 'error',
      intent,
      model: MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    }
  }

  let recentCalls: CallRow[] = []
  try {
    recentCalls = await fetchLastNCalls(opts.supa, client.id, RECENT_CALLS_N)
  } catch {
    recentCalls = []
  }

  const systemPrompt = buildSystemPrompt(client, recentCalls, opts.timezone)

  let raw: OpenRouterResponse | null = null
  const outcome: AssistantOutcome = 'ok'
  try {
    const res = await fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 429) {
      return {
        reply: '⏱ Busy right now — try again in a moment, or tap below.',
        outcome: 'fallback',
        intent,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
      }
    }
    if (!res.ok) {
      return {
        reply: "I can't reach the assistant right now — Tier 1 commands still work.",
        outcome: 'error',
        intent,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
      }
    }
    raw = (await res.json()) as OpenRouterResponse
  } catch (err) {
    const isTimeout = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError'
    return {
      reply: isTimeout
        ? 'That took too long. Try /calls or tap below.'
        : "I can't reach the assistant right now — Tier 1 commands still work.",
      outcome: isTimeout ? 'timeout' : 'error',
      intent,
      model: MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
    }
  }

  const content = raw?.choices?.[0]?.message?.content?.trim() ?? ''
  const inputTokens = raw?.usage?.prompt_tokens ?? 0
  const outputTokens = raw?.usage?.completion_tokens ?? 0
  const latencyMs = Date.now() - start

  if (!content) {
    return { reply: FALLBACK_REPLY, outcome: 'fallback', intent, model: MODEL, inputTokens, outputTokens, latencyMs }
  }

  if (!citationGuardOk(content, recentCalls)) {
    return { reply: FALLBACK_REPLY, outcome: 'fallback', intent, model: MODEL, inputTokens, outputTokens, latencyMs }
  }

  return { reply: content, outcome, intent, model: MODEL, inputTokens, outputTokens, latencyMs }
}
