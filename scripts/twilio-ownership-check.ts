/**
 * Twilio ↔ Supabase Ownership Drift Harness
 *
 * Nightly check. Catches the silent-fail class where Twilio releases /
 * suspends / ports-out / mis-routes a number we still believe we own:
 *   - DB has `clients.twilio_number` that Twilio doesn't have (calls 404)
 *   - Twilio status != 'in-use' (suspended for billing / compliance)
 *   - voiceUrl drift (someone edited it in Twilio console)
 *   - voiceFallbackUrl / statusCallback drift
 *   - Orphan numbers in Twilio account (paying $1.15/mo for nothing)
 *   - Capability missing (sms_enabled in DB but Twilio number doesn't support SMS)
 *
 * Source of truth for comparison logic: src/lib/twilio-ownership.ts (pure,
 * testable). This script is just the I/O wiring.
 *
 * Run:
 *   npx tsx scripts/twilio-ownership-check.ts            # write findings + Telegram on P0
 *   npx tsx scripts/twilio-ownership-check.ts --dry-run  # log only — no DB writes, no Telegram
 *
 * Exit codes:
 *   0 — no findings
 *   1 — P1 only
 *   2 — at least one P0 (calls failing) OR setup/env error
 *
 * Idempotency: harness-writer keys on (harness, check_name, client_slug). Re-runs
 * UPDATE last_seen_at on existing rows. Resolved rows that re-appear flip back
 * to 'open' and re-notify.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { recordFindings, type Finding } from '../src/lib/harness-writer.js'
import {
  diffOwnership,
  type OwnershipClientRow,
  type TwilioInventoryNumber,
} from '../src/lib/twilio-ownership.js'

const DRY_RUN = process.argv.includes('--dry-run')

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://endvoicemail.ai').replace(/\/$/, '')
const VOICE_FALLBACK_URL = process.env.VOICE_FALLBACK_URL || 'https://fallback.endvoicemail.ai/voice'
const RUN_ID = process.env.GITHUB_RUN_ID || String(Date.now())

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error('[twilio-ownership] Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN')
  process.exit(2)
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[twilio-ownership] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
if (!DRY_RUN && !TELEGRAM_BOT_TOKEN) {
  console.error('[twilio-ownership] Missing TELEGRAM_BOT_TOKEN (required unless --dry-run)')
  process.exit(2)
}

async function fetchClients(): Promise<OwnershipClientRow[]> {
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb
    .from('clients')
    .select('slug, twilio_number, sms_enabled')
    .not('twilio_number', 'is', null)
    .order('slug')
  if (error) throw new Error(`Supabase clients fetch failed: ${error.message}`)
  return ((data ?? []) as Array<{ slug: string; twilio_number: string; sms_enabled: boolean | null }>)
    .filter(r => !!r.twilio_number)
    .map(r => ({ slug: r.slug, twilio_number: r.twilio_number, sms_enabled: r.sms_enabled }))
}

async function fetchTwilioInventory(): Promise<TwilioInventoryNumber[]> {
  const tw = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!)
  const numbers = await tw.incomingPhoneNumbers.list({ limit: 1000 })
  return numbers.map(n => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    status: n.status,
    voiceUrl: n.voiceUrl || null,
    voiceFallbackUrl: n.voiceFallbackUrl || null,
    statusCallback: n.statusCallback || null,
    capabilities: {
      voice: n.capabilities?.voice,
      sms: n.capabilities?.sms,
      mms: n.capabilities?.mms,
      fax: n.capabilities?.fax,
    },
  }))
}

async function resolveOwnerChatId(): Promise<string | null> {
  if (TELEGRAM_OWNER_CHAT_ID) return TELEGRAM_OWNER_CHAT_ID
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb
    .from('clients')
    .select('telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .maybeSingle()
  if (error) {
    console.warn(`[twilio-ownership] owner chat-id lookup failed: ${error.message}`)
    return null
  }
  return (data as { telegram_chat_id: string | null } | null)?.telegram_chat_id ?? null
}

function formatTelegramMessage(p0: Finding[], totalFindings: number, dbCount: number, twCount: number): string {
  const lines: string[] = [
    `🚨 <b>Twilio Ownership Drift</b> — ${p0.length} P0 finding(s)`,
    `Scope: ${dbCount} DB number(s) vs ${twCount} Twilio number(s) — total findings ${totalFindings}`,
    '',
  ]
  // Cap message body so we stay under Telegram's 4096-char limit.
  for (const f of p0.slice(0, 12)) {
    const slug = f.client_slug ?? '(account)'
    lines.push(`• <b>${slug}</b> · ${f.check_name}`)
    lines.push(`  ${truncate(f.summary, 200)}`)
  }
  if (p0.length > 12) lines.push(`<i>…and ${p0.length - 12} more — see harness_findings dashboard</i>`)
  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    console.error(`[twilio-ownership] Telegram send failed HTTP ${res.status}: ${await res.text().catch(() => '')}`)
    return false
  }
  return true
}

async function main(): Promise<number> {
  console.log(`[twilio-ownership] Starting${DRY_RUN ? ' (dry-run)' : ''} run_id=${RUN_ID}`)

  let clients: OwnershipClientRow[]
  let inventory: TwilioInventoryNumber[]
  try {
    [clients, inventory] = await Promise.all([fetchClients(), fetchTwilioInventory()])
  } catch (e) {
    console.error(`[twilio-ownership] Fetch failed: ${(e as Error).message}`)
    return 2
  }
  console.log(`[twilio-ownership] DB clients with twilio_number: ${clients.length}`)
  console.log(`[twilio-ownership] Twilio inventory size: ${inventory.length}`)

  const findings = diffOwnership(clients, inventory, {
    appUrl: APP_URL,
    voiceFallbackUrl: VOICE_FALLBACK_URL,
    statusCallback: null, // not currently set by ensureTwilioProvisioned; skip this dimension until it is
  })

  const p0 = findings.filter(f => f.severity === 'P0')
  const p1 = findings.filter(f => f.severity === 'P1')
  console.log(`[twilio-ownership] Findings: total=${findings.length} P0=${p0.length} P1=${p1.length}`)

  // Per-finding log so the GH Action run is debuggable without DB access.
  for (const f of findings) {
    const slug = f.client_slug ?? '(account)'
    console.log(`  [${f.severity}] ${slug} · ${f.check_name}: ${f.summary}`)
  }

  if (DRY_RUN) {
    console.log('[twilio-ownership] DRY RUN — skipping recordFindings + Telegram')
    if (p0.length > 0) return 2
    if (p1.length > 0) return 1
    return 0
  }

  // Persist via harness-writer (handles open/resolved/reopen logic).
  try {
    const result = await recordFindings({ harness: 'twilio-ownership', run_id: RUN_ID, findings })
    console.log(`[twilio-ownership] recordFindings: written=${result.written} reopened=${result.reopened} errors=${result.errors.length}`)
    for (const err of result.errors) console.error(`  recordFindings error: ${err}`)
  } catch (e) {
    console.error(`[twilio-ownership] recordFindings threw: ${(e as Error).message}`)
    // Keep going — still alert on Telegram if P0.
  }

  if (p0.length > 0) {
    const chatId = await resolveOwnerChatId()
    if (!chatId) {
      console.error('[twilio-ownership] No owner chat-id — cannot send Telegram alert')
    } else {
      const sent = await sendTelegram(chatId, formatTelegramMessage(p0, findings.length, clients.length, inventory.length))
      console.log(`[twilio-ownership] Telegram alert sent=${sent}`)
    }
    return 2
  }
  if (p1.length > 0) return 1
  return 0
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[twilio-ownership] Fatal:', err)
    process.exit(2)
  })
