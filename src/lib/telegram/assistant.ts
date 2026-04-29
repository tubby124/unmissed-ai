import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { CallRow } from './queries'
import { fetchLastNCalls, type TelegramClientRow } from './queries'
import type { AssistantIntent } from './types'
import type { TopUrgent } from './menu'
import { fetchMtdSpendUsd } from './operator'

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
  /**
   * Tier 3: top open HOT/WARM call (lead_status null or 'new'), set only
   * when intent='urgent'. Lets the webhook render tap-to-act buttons in
   * the urgent reply keyboard. Undefined when no urgent row exists; the
   * keyboard falls back to the static "see all missed" set.
   */
  topUrgent?: TopUrgent
}

/**
 * Pick the top open urgent call from the recent-calls window.
 *
 * Definition of urgent (must match the system prompt's # OUTPUT RULES line
 * for "anything urgent?" — we use the same definition end-to-end so the
 * keyboard CTA never points at a row the model didn't surface):
 *   call_status IN ('HOT', 'WARM')
 *   AND (lead_status IS NULL OR lead_status = 'new')
 *
 * recentCalls is already ordered newest-first by fetchLastNCalls, so the
 * first match is the most recent open urgent — that's the one the owner
 * would call back first. Returns undefined when nothing matches.
 */
export function pickTopUrgent(rows: CallRow[]): TopUrgent | undefined {
  for (const r of rows) {
    const isHotOrWarm = r.call_status === 'HOT' || r.call_status === 'WARM'
    const isOpen = r.lead_status === null || r.lead_status === 'new'
    if (isHotOrWarm && isOpen) {
      return { id: r.id, name: r.caller_name ?? null }
    }
  }
  return undefined
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
  // Tier 3 reply-audit sampling. Default = Math.random; tests inject a
  // deterministic stub to verify the 1% rate.
  randomImpl?: () => number
  // Tier 3 sample rate. Default 0.01 (1%). Tests can pass 1.0 to force
  // sampling on every call.
  auditSampleRate?: number
}

const DEFAULT_AUDIT_SAMPLE_RATE = 0.01

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Sample a reply into telegram_reply_audit at the configured rate.
 * Fire-and-forget — explicit exception to the project's "All DB writes
 * awaited" rule (command-routing.md). The exception holds because:
 *  (a) outcome is non-blocking — user already sees the reply,
 *  (b) failure to log is non-user-facing,
 *  (c) at 1% across 5 active clients, the volume is ~3 rows/mo.
 *
 * NEVER stores the user's free-text question. system_prompt is hashed
 * because it embeds business_facts + extra_qa which the customer owns.
 */
function maybeSampleReplyAudit(
  supa: SupabaseClient,
  rng: () => number,
  rate: number,
  payload: {
    client_id: string
    system_prompt: string
    reply: string
    recent_calls_count: number
    citation_passed: boolean
    intent: AssistantIntent
  },
): void {
  if (rng() >= rate) return
  void supa
    .from('telegram_reply_audit')
    .insert({
      client_id: payload.client_id,
      system_prompt_hash: sha256Hex(payload.system_prompt),
      reply: payload.reply,
      recent_calls_count: payload.recent_calls_count,
      citation_passed: payload.citation_passed,
      intent: payload.intent,
    })
    .then((res: { error: { message: string } | null } | undefined) => {
      if (res?.error) {
        console.warn(`[telegram-audit] insert failed: ${res.error.message}`)
      }
    })
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

  // ── Tier 3: spend-cap throttle ────────────────────────────────────────
  // BEFORE the OpenRouter fetch — a runaway loop must not be able to
  // bankrupt the account. Tier 1 commands (/calls, /missed, /minutes, …)
  // bypass this code path entirely; only NL Q&A passes through here.
  // cap === 0 disables the throttle.
  const cap = Number(client.telegram_assistant_cap_usd ?? 5.0)
  if (cap > 0) {
    const { spendUsd } = await fetchMtdSpendUsd(opts.supa, client.id, opts.timezone)
    if (spendUsd >= cap) {
      const topUrgent = intent === 'urgent' ? pickTopUrgent(recentCalls) : undefined
      return {
        reply: `You've hit this month's assistant cap ($${cap.toFixed(2)}). Tier 1 commands like /calls, /missed, and /minutes still work.`,
        outcome: 'fallback',
        intent,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        topUrgent,
      }
    }
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
  const topUrgent = intent === 'urgent' ? pickTopUrgent(recentCalls) : undefined
  const rng = opts.randomImpl ?? Math.random
  const sampleRate = opts.auditSampleRate ?? DEFAULT_AUDIT_SAMPLE_RATE

  if (!content) {
    const finalReply = FALLBACK_REPLY
    maybeSampleReplyAudit(opts.supa, rng, sampleRate, {
      client_id: client.id,
      system_prompt: systemPrompt,
      reply: finalReply,
      recent_calls_count: recentCalls.length,
      citation_passed: false,
      intent,
    })
    return { reply: finalReply, outcome: 'fallback', intent, model: MODEL, inputTokens, outputTokens, latencyMs, topUrgent }
  }

  const cited = citationGuardOk(content, recentCalls)
  if (!cited) {
    const finalReply = FALLBACK_REPLY
    maybeSampleReplyAudit(opts.supa, rng, sampleRate, {
      client_id: client.id,
      system_prompt: systemPrompt,
      reply: finalReply,
      recent_calls_count: recentCalls.length,
      citation_passed: false,
      intent,
    })
    return { reply: finalReply, outcome: 'fallback', intent, model: MODEL, inputTokens, outputTokens, latencyMs, topUrgent }
  }

  maybeSampleReplyAudit(opts.supa, rng, sampleRate, {
    client_id: client.id,
    system_prompt: systemPrompt,
    reply: content,
    recent_calls_count: recentCalls.length,
    citation_passed: true,
    intent,
  })
  return { reply: content, outcome, intent, model: MODEL, inputTokens, outputTokens, latencyMs, topUrgent }
}
