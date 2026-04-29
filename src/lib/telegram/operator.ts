/**
 * Tier 3 operator commands. Three commands gated by `client.slug ===
 * 'hasan-sharif'` (per L18 — Tier 4 introduces a real platform_operators
 * table; for now slug-match is sufficient).
 *
 * Output rules (L19): /health never reveals slugs or agent IDs even in
 * error messages. /clients can show slugs because it IS the fleet view.
 * /spend is scoped to the calling client_id only.
 *
 * Costing: $1/M input + $5/M output (Haiku 4.5 rates as of 2026-04). The
 * formula is shared between /spend (display) and the per-client cap
 * throttle (commit 5). Numbers are decimal-clean to 4 places — the
 * `numeric(10,4)` cap column matches.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { renderUnknown } from './format'
import { buildQuickActionsKeyboard } from './menu'
import type { InlineKeyboardMarkup } from './types'

export interface OperatorContext {
  supa: SupabaseClient
  timezone: string
}

export type OperatorReply = { text: string; reply_markup?: InlineKeyboardMarkup }

const HAIKU_INPUT_PER_M_USD = 1.0
const HAIKU_OUTPUT_PER_M_USD = 5.0

export function isOperatorCommand(cmd: string): boolean {
  return cmd === '/clients' || cmd === '/health' || cmd === '/spend'
}

export function isOperatorSlug(slug: string | null | undefined): boolean {
  return slug === 'hasan-sharif'
}

/**
 * MTD start in the client's timezone, expressed as a UTC ISO string for
 * SQL filtering. The DB column is `created_at timestamptz`, so the right
 * comparison is "first instant of the local month, converted to UTC".
 *
 * Implementation: render the local YYYY-MM via Intl.DateTimeFormat (the
 * only built-in tz-aware formatter in Node), append "-01T00:00:00", and
 * round-trip through Date. The resulting Date is interpreted in the
 * server's local tz (close enough to UTC on Railway), which is fine for
 * SQL filtering since we don't need second-precision on a month boundary.
 */
export function monthStartUtcIso(timezone: string, now: Date = new Date()): string {
  const ym = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).format(now) // 'YYYY-MM' for en-CA (or sometimes 'YYYY/MM' depending on Node ICU)
  const normalized = ym.replace('/', '-')
  const localMidnight = new Date(`${normalized}-01T00:00:00`)
  return localMidnight.toISOString()
}

/**
 * Compute MTD spend for one client from telegram_assistant_log.
 * Returns USD (number, 4-decimal precision).
 *
 * Throttle check (commit 5) reuses this. Operator /spend reuses this.
 * Single SQL aggregate — small and indexed by (client_id, created_at).
 */
export async function fetchMtdSpendUsd(
  supa: SupabaseClient,
  clientId: string,
  timezone: string,
): Promise<{ spendUsd: number; turns: number; ok: number; fallback: number; timeout: number; error: number }> {
  const startIso = monthStartUtcIso(timezone)
  const { data, error } = await supa
    .from('telegram_assistant_log')
    .select('input_tokens, output_tokens, outcome')
    .eq('client_id', clientId)
    .gte('created_at', startIso)

  if (error || !data) {
    if (error) console.warn(`[telegram-operator] MTD fetch failed: ${error.message}`)
    return { spendUsd: 0, turns: 0, ok: 0, fallback: 0, timeout: 0, error: 0 }
  }

  let inputSum = 0
  let outputSum = 0
  let ok = 0
  let fallback = 0
  let timeout = 0
  let errorCount = 0
  for (const row of data) {
    inputSum += Number(row.input_tokens ?? 0)
    outputSum += Number(row.output_tokens ?? 0)
    switch (row.outcome) {
      case 'ok': ok += 1; break
      case 'fallback': fallback += 1; break
      case 'timeout': timeout += 1; break
      case 'error': errorCount += 1; break
    }
  }
  const spendUsd =
    (inputSum / 1_000_000) * HAIKU_INPUT_PER_M_USD +
    (outputSum / 1_000_000) * HAIKU_OUTPUT_PER_M_USD
  return {
    spendUsd: Math.round(spendUsd * 10000) / 10000,
    turns: data.length,
    ok,
    fallback,
    timeout,
    error: errorCount,
  }
}

interface FleetRow {
  slug: string
  chat_id: string | null
  last_call_at: string | null
  minutes_used: number
  monthly_minute_limit: number | null
  cap_pct: number | null // null = no cap configured (cap=0 disables throttle)
}

async function fetchFleetRows(supa: SupabaseClient, timezone: string): Promise<FleetRow[]> {
  const { data: clients, error } = await supa
    .from('clients')
    .select('id, slug, telegram_chat_id, monthly_minute_limit, seconds_used_this_month, telegram_assistant_cap_usd')
    .in('status', ['active', 'setup', 'trialing'])
    .order('slug', { ascending: true })

  if (error || !clients) {
    if (error) console.warn(`[telegram-operator] fleet fetch failed: ${error.message}`)
    return []
  }

  const rows: FleetRow[] = []
  for (const c of clients) {
    const clientId = c.id as string
    // Last call timestamp — newest started_at on call_logs for this client.
    const { data: lastRow } = await supa
      .from('call_logs')
      .select('started_at')
      .eq('client_id', clientId)
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    let capPct: number | null = null
    const capUsd = Number(c.telegram_assistant_cap_usd ?? 0)
    if (capUsd > 0) {
      const { spendUsd } = await fetchMtdSpendUsd(supa, clientId, timezone)
      capPct = Math.round((spendUsd / capUsd) * 100)
    }

    rows.push({
      slug: c.slug as string,
      chat_id: (c.telegram_chat_id as string | null) ?? null,
      last_call_at: (lastRow?.started_at as string | null) ?? null,
      minutes_used: Math.ceil(Number(c.seconds_used_this_month ?? 0) / 60),
      monthly_minute_limit: (c.monthly_minute_limit as number | null) ?? null,
      cap_pct: capPct,
    })
  }
  return rows
}

function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const deltaMs = now.getTime() - t
  if (deltaMs < 0) return 'just now'
  const mins = Math.floor(deltaMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 2) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return iso.slice(0, 10)
}

/**
 * Fleet roll-up (operator only). Renders a fixed-width <pre> table with
 * one row per active client. chat_id is truncated to first 4 digits as
 * hygiene — fleet view is operator-private but full chat_ids never need
 * to appear in a Telegram message.
 */
export async function renderClients(ctx: OperatorContext): Promise<OperatorReply> {
  const rows = await fetchFleetRows(ctx.supa, ctx.timezone)
  if (rows.length === 0) {
    return { text: '<b>Fleet</b>\nNo active clients.', reply_markup: buildQuickActionsKeyboard() }
  }

  const header = ['slug', 'tg', 'last call', 'minutes', 'cap%']
  const tableRows = rows.map((r) => {
    const slugCol = r.slug.padEnd(20).slice(0, 20)
    const chat = r.chat_id ? `✅ ${r.chat_id.slice(0, 4)}…`.padEnd(8) : '❌ —'.padEnd(8)
    const last = relativeTime(r.last_call_at).padEnd(12)
    const limitText = r.monthly_minute_limit ?? '—'
    const minutes = `${r.minutes_used}/${limitText}`.padEnd(12)
    const cap = r.cap_pct === null ? '—' : `${r.cap_pct}%`
    return `${slugCol}  ${chat}  ${last}  ${minutes}  ${cap}`
  })

  const text = [
    `<b>Fleet — ${rows.length} active client${rows.length === 1 ? '' : 's'}</b>`,
    `<pre>`,
    `${header[0]!.padEnd(20)}  ${header[1]!.padEnd(8)}  ${header[2]!.padEnd(12)}  ${header[3]!.padEnd(12)}  ${header[4]}`,
    ...tableRows,
    `</pre>`,
  ].join('\n')

  return { text, reply_markup: buildQuickActionsKeyboard() }
}

interface HealthInputs {
  deploySha: string
  deployRelative: string
  openrouterP95Ms: number | null
  dbLagSeconds: number | null
  activeClients: number
  errors24h: number
}

export function formatHealth(inputs: HealthInputs): string {
  const sha = inputs.deploySha ? `<code>${inputs.deploySha}</code>` : '—'
  const p95 = inputs.openrouterP95Ms === null ? '—' : `${(inputs.openrouterP95Ms / 1000).toFixed(1)}s`
  const lag = inputs.dbLagSeconds === null ? '—' : `${inputs.dbLagSeconds.toFixed(1)}s`
  return [
    '<b>Fleet health</b>',
    `Deploys: ✅ ${sha} (Railway ${inputs.deployRelative})`,
    `OpenRouter p95: ${p95} (last 1h)`,
    `DB lag: ${lag}`,
    `Active clients: ${inputs.activeClients}`,
    `Errors (24h): ${inputs.errors24h}`,
  ].join('\n')
}

export async function renderHealth(ctx: OperatorContext): Promise<OperatorReply> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3_600_000).toISOString()
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString()

  // Deploy SHA — Railway exposes the commit hash in env. Truncate to 7 chars.
  const fullSha = (process.env.RAILWAY_GIT_COMMIT_SHA ?? '').trim()
  const deploySha = fullSha ? fullSha.slice(0, 7) : ''
  const deployRelative = process.env.RAILWAY_DEPLOYMENT_ID ? 'just deployed' : 'unknown'

  // p95 latency over the last hour, all clients, ok-only.
  let p95Ms: number | null = null
  const { data: latencyRows } = await ctx.supa
    .from('telegram_assistant_log')
    .select('latency_ms')
    .eq('outcome', 'ok')
    .gte('created_at', oneHourAgo)
    .order('latency_ms', { ascending: true })
  if (latencyRows && latencyRows.length > 0) {
    const sorted = latencyRows
      .map((r) => Number(r.latency_ms ?? 0))
      .sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
    p95Ms = sorted[idx] ?? null
  }

  // DB lag — now() − newest call_logs.created_at across all clients.
  let dbLagSeconds: number | null = null
  const { data: latestCall } = await ctx.supa
    .from('call_logs')
    .select('created_at')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (latestCall?.created_at) {
    const t = new Date(latestCall.created_at as string).getTime()
    if (!Number.isNaN(t)) dbLagSeconds = Math.max(0, (now.getTime() - t) / 1000)
  }

  // Active client count.
  const { count: activeCount } = await ctx.supa
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'setup', 'trialing'])

  // Errors in the last 24h — outcome IN ('error','timeout'). Throttled
  // turns are 'fallback' and intentionally excluded.
  const { count: errCount } = await ctx.supa
    .from('telegram_assistant_log')
    .select('id', { count: 'exact', head: true })
    .in('outcome', ['error', 'timeout'])
    .gte('created_at', dayAgo)

  const text = formatHealth({
    deploySha,
    deployRelative,
    openrouterP95Ms: p95Ms,
    dbLagSeconds,
    activeClients: Number(activeCount ?? 0),
    errors24h: Number(errCount ?? 0),
  })

  return { text, reply_markup: buildQuickActionsKeyboard() }
}

export async function renderSpend(
  ctx: OperatorContext,
  clientId: string,
  slug: string,
  capUsd: number,
): Promise<OperatorReply> {
  const summary = await fetchMtdSpendUsd(ctx.supa, clientId, ctx.timezone)
  const pct = capUsd > 0 ? Math.round((summary.spendUsd / capUsd) * 100) : 0
  const capLabel = capUsd > 0 ? `$${capUsd.toFixed(2)}` : 'no cap'
  const pctLabel = capUsd > 0 ? ` (${pct}%)` : ''
  const text = [
    '<b>This month</b>',
    `${slug}: $${summary.spendUsd.toFixed(2)} / ${capLabel}${pctLabel}`,
    `${summary.turns} turn${summary.turns === 1 ? '' : 's'} · ok=${summary.ok} fallback=${summary.fallback} timeout=${summary.timeout} error=${summary.error}`,
  ].join('\n')
  return { text, reply_markup: buildQuickActionsKeyboard() }
}

export async function dispatchOperatorCommand(
  cmd: string,
  ctx: OperatorContext,
  client: { id: string; slug: string; capUsd: number },
): Promise<OperatorReply> {
  switch (cmd) {
    case '/clients':
      return renderClients(ctx)
    case '/health':
      return renderHealth(ctx)
    case '/spend':
      return renderSpend(ctx, client.id, client.slug, client.capUsd)
    default:
      return { text: renderUnknown(), reply_markup: buildQuickActionsKeyboard() }
  }
}
