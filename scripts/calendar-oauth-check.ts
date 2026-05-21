/**
 * calendar-oauth-check.ts — runner for the calendar-OAuth-validity harness.
 *
 * For every client with booking_enabled=true + calendar_auth_status='connected',
 * exercises the Google refresh-token endpoint with the stored refresh_token.
 * Catches revoked tokens / deleted calendars / our-OAuth-app-broken BEFORE a
 * real caller tries to book and silently fails.
 *
 * NEVER writes new tokens to the DB (google-calendar.ts owns the runtime
 * cache) and NEVER mutates Google calendar state. Read-only by design.
 *
 * Local: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *        GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
 *        npx tsx scripts/calendar-oauth-check.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import {
  checkClient,
  classifyRefreshResponse,
  maybeEscalateInvalidClient,
  exitCodeForFindings,
  type DbClientForCalendarCheck,
  type RefreshOutcome,
  type CalendarOAuthFinding,
} from '../src/lib/calendar-oauth'
import { recordFindings, type Finding, type Severity } from '../src/lib/harness-writer'

const DRY_RUN = process.argv.includes('--dry-run')
const RUN_ID = process.env.GITHUB_RUN_ID ?? String(Date.now())

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function requireEnv(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(`[calendar-oauth] missing env var: ${name}`)
    process.exit(2)
  }
}

async function refreshOnce(refreshToken: string): Promise<{ status: number; body: any }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  let body: any = null
  try { body = await res.json() } catch { /* non-json — body stays null */ }
  return { status: res.status, body }
}

async function refreshWithRetry(refreshToken: string): Promise<RefreshOutcome> {
  const first = await refreshOnce(refreshToken)
  const out = classifyRefreshResponse(first.status, first.body)
  if (out.kind === 'transient') {
    // Retry once on Google 5xx
    await new Promise(r => setTimeout(r, 1500))
    const second = await refreshOnce(refreshToken)
    return classifyRefreshResponse(second.status, second.body)
  }
  return out
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return
  const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } })
  let chatId = process.env.TELEGRAM_OWNER_CHAT_ID
  if (!chatId) {
    const { data } = await sb.from('clients').select('telegram_chat_id').eq('slug', 'hasan-sharif').maybeSingle()
    chatId = data?.telegram_chat_id ?? undefined
  }
  if (!chatId) {
    console.warn('[calendar-oauth] no telegram chat id resolved; skipping alert')
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(e => console.warn('[calendar-oauth] telegram send failed:', e?.message ?? e))
}

async function main() {
  requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_KEY)
  requireEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
  requireEnv('GOOGLE_CLIENT_SECRET', GOOGLE_CLIENT_SECRET)

  console.log(`[calendar-oauth] starting run_id=${RUN_ID} dry_run=${DRY_RUN}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: rows, error } = await sb
    .from('clients')
    .select('id, slug, booking_enabled, calendar_auth_status, google_refresh_token, google_calendar_id')
    .eq('booking_enabled', true)
    .eq('calendar_auth_status', 'connected')

  if (error) {
    console.error('[calendar-oauth] supabase select failed:', error.message)
    process.exit(2)
  }
  const clients: DbClientForCalendarCheck[] = (rows ?? []).map(r => ({
    id: r.id as string,
    slug: r.slug as string,
    booking_enabled: r.booking_enabled as boolean,
    calendar_auth_status: r.calendar_auth_status as string | null,
    google_refresh_token: r.google_refresh_token as string | null,
    google_calendar_id: r.google_calendar_id as string | null,
  }))
  console.log(`[calendar-oauth] eligible clients: ${clients.length}`)

  const allFindings: CalendarOAuthFinding[] = []
  for (const c of clients) {
    if (!c.google_refresh_token) {
      // checkClient handles this case (oauth_refresh_token_missing finding)
      allFindings.push(...checkClient(c, { kind: 'unknown_error', status: 0, description: 'no_refresh_token' }))
      continue
    }
    const refresh = await refreshWithRetry(c.google_refresh_token)
    allFindings.push(...checkClient(c, refresh))
    console.log(`  ${c.slug}: refresh.kind=${refresh.kind}`)
  }

  // Escalate to account-level if many clients hit invalid_client simultaneously
  const escalated = maybeEscalateInvalidClient(allFindings, clients.length)
  const finalFindings = escalated ? [...allFindings, escalated] : allFindings

  const counts = { P0: 0, P1: 0, P2: 0 }
  for (const f of finalFindings) counts[f.severity as 'P0' | 'P1' | 'P2']++
  console.log(`[calendar-oauth] findings: total=${finalFindings.length} P0=${counts.P0} P1=${counts.P1} P2=${counts.P2}`)

  if (DRY_RUN) {
    console.log('[calendar-oauth] DRY_RUN — skipping recordFindings + telegram')
    finalFindings.forEach(f => console.log(`  [${f.severity}] ${f.client_slug ?? '(account)'} · ${f.check_name}: ${f.summary}`))
    process.exit(exitCodeForFindings(finalFindings))
  }

  const writerInput: Finding[] = finalFindings.map(f => ({
    check_name: f.check_name,
    severity: f.severity as Severity,
    client_slug: f.client_slug,
    summary: f.summary,
    details: f.details,
  }))
  const result = await recordFindings({ harness: 'calendar-oauth', run_id: RUN_ID, findings: writerInput })
  console.log(`[calendar-oauth] recordFindings: written=${result.written} reopened=${result.reopened} errors=${result.errors.length}`)
  for (const err of result.errors) console.warn(`  [recordFindings] ${err}`)

  if (counts.P0 > 0) {
    const lines = finalFindings
      .filter(f => f.severity === 'P0')
      .map(f => `• \`${f.client_slug ?? '(account)'}\` — ${f.check_name}: ${f.summary}`)
      .join('\n')
    await sendTelegram(`🚨 *Calendar OAuth* — ${counts.P0} P0 finding(s)\n\n${lines}\n\nReview: /dashboard/admin/harness`)
  }

  process.exit(exitCodeForFindings(finalFindings))
}

main().catch(err => {
  console.error('[calendar-oauth] uncaught:', err)
  process.exit(2)
})
