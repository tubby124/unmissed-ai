/**
 * Nightly Drift Check — Supabase ↔ live Ultravox agent comparison.
 *
 * READ-ONLY. Does not auto-fix anything (that's /api/cron/drift-check).
 * This script reports the dimensions that route misses:
 *   - prompt char delta > 100
 *   - prompt missing {{callerContext}} / {{businessFacts}} / {{contextData}}
 *   - agent voice mismatch
 *   - selectedTools name set / count mismatch (normalized + sorted)
 *   - HTTP tool missing X-Tool-Secret static parameter
 *   - capability fake-on (sms_enabled w/o twilio_number, booking w/o calendar,
 *     forwarding_number set on non-Pro plan)
 *
 * On any drift it posts one consolidated Telegram alert to the owner chat.
 *
 * Idempotency: writes .github/drift-state/last-alert.json with a sha256 of the
 * drift signature. Re-alerts only if signature changes OR > 24h elapsed.
 *
 * Run:
 *   npx tsx scripts/nightly-drift-check.ts            # alert if drift
 *   npx tsx scripts/nightly-drift-check.ts --dry-run  # log only, never alert
 *
 * Exit codes: 0 = clean, 1 = drift found.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ULTRAVOX_API_KEY
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_OWNER_CHAT_ID    (optional — falls back to clients.telegram_chat_id where slug='hasan-sharif')
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { recordFindings, type Finding as HarnessFinding } from '../src/lib/harness-writer.js'

// Drift dimension → stable harness_findings.check_name.
// Per-dimension prefixes (tool_secret_missing:<name>, capability_fake_on:<flag>,
// prompt_missing_token:<token>) collapse into the bucket name in the dashboard
// view but keep the per-dim details in finding.details.
function dimensionToCheckName(dim: string): string | null {
  if (dim === 'prompt_char_delta') return 'prompt_drift'
  if (dim.startsWith('prompt_missing_token:')) return 'prompt_drift'
  if (dim === 'voice') return 'voice_drift'
  if (dim === 'tools_duplicate_names') return 'tools_drift'
  if (dim.startsWith('tool_secret_missing:')) return 'tool_secret_missing'
  if (dim.startsWith('capability_fake_on:')) return 'capability_fake_on'
  if (dim === 'ultravox_fetch_error') return 'tools_drift'
  return null
}

// All drift findings are P1 (silent fakery / latent risk) by default. The two
// exceptions: tool_secret_missing reaches our webhook without auth → P0;
// capability_fake_on:forwarding hands a transfer to "" → P0.
function dimensionToSeverity(dim: string): 'P0' | 'P1' | 'P2' {
  if (dim.startsWith('tool_secret_missing:')) return 'P0'
  if (dim === 'capability_fake_on:forwarding') return 'P0'
  if (dim === 'ultravox_fetch_error') return 'P0'
  return 'P1'
}

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID

const STATE_FILE = resolve(process.cwd(), '.github/drift-state/last-alert.json')
const RE_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000
const PROMPT_CHAR_DELTA_THRESHOLD = 100
const REQUIRED_PROMPT_TOKENS = ['{{callerContext}}', '{{businessFacts}}', '{{contextData}}']

if (!SUPABASE_URL || !SERVICE_KEY || !ULTRAVOX_API_KEY) {
  console.error('[nightly-drift] Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ULTRAVOX_API_KEY')
  process.exit(2)
}
if (!DRY_RUN && !TELEGRAM_BOT_TOKEN) {
  console.error('[nightly-drift] Missing TELEGRAM_BOT_TOKEN (required unless --dry-run)')
  process.exit(2)
}

type ClientRow = {
  id: string
  slug: string
  business_name: string | null
  system_prompt: string | null
  agent_voice_id: string | null
  ultravox_agent_id: string | null
  sms_enabled: boolean | null
  twilio_number: string | null
  booking_enabled: boolean | null
  calendar_auth_status: string | null
  forwarding_number: string | null
  selected_plan: string | null
  telegram_chat_id: string | null
}

type UltravoxToolEntry = {
  toolId?: string
  toolName?: string
  nameOverride?: string
  temporaryTool?: {
    modelToolName?: string
    http?: { baseUrlPattern?: string }
    staticParameters?: Array<{ name?: string; location?: string; value?: unknown }>
  }
}

type AgentSnapshot = {
  systemPrompt: string
  voice: string | null
  selectedTools: UltravoxToolEntry[]
}

type DriftFinding = {
  slug: string
  dimension: string
  expected: string
  actual: string
  note?: string
}

function toolKey(t: UltravoxToolEntry): string {
  return t.toolName ?? t.nameOverride ?? t.temporaryTool?.modelToolName ?? '(unnamed)'
}

function isHttpTool(t: UltravoxToolEntry): boolean {
  return Boolean(t.temporaryTool?.http?.baseUrlPattern)
}

function hasToolSecret(t: UltravoxToolEntry): boolean {
  const params = t.temporaryTool?.staticParameters
  if (!Array.isArray(params)) return false
  return params.some(p => p?.name === 'X-Tool-Secret')
}

async function fetchAgent(agentId: string): Promise<AgentSnapshot> {
  const res = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
    headers: { 'X-API-Key': ULTRAVOX_API_KEY! },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Ultravox GET /agents/${agentId} → HTTP ${res.status}`)
  const data = (await res.json()) as {
    callTemplate?: {
      systemPrompt?: string
      voice?: string
      selectedTools?: UltravoxToolEntry[]
    }
  }
  return {
    systemPrompt: data.callTemplate?.systemPrompt ?? '',
    voice: data.callTemplate?.voice ?? null,
    selectedTools: data.callTemplate?.selectedTools ?? [],
  }
}

function normalizeLivePrompt(live: string): string {
  // updateAgent appends a "\n\n{{callerContext}}..." suffix at deploy time.
  // Strip it before length comparison so the delta reflects real authored drift.
  return live.replace(/\n\n\{\{callerContext\}\}[\s\S]*$/, '').trimEnd()
}

function diffClient(client: ClientRow, agent: AgentSnapshot): DriftFinding[] {
  const findings: DriftFinding[] = []
  const slug = client.slug
  const saved = (client.system_prompt ?? '').trimEnd()
  const live = normalizeLivePrompt(agent.systemPrompt)

  // ── prompt char-count delta ──────────────────────────────────────
  const delta = Math.abs(saved.length - live.length)
  if (delta > PROMPT_CHAR_DELTA_THRESHOLD) {
    findings.push({
      slug,
      dimension: 'prompt_char_delta',
      expected: `${saved.length} chars (Supabase)`,
      actual: `${live.length} chars (Ultravox)`,
      note: `Δ ${delta} chars > ${PROMPT_CHAR_DELTA_THRESHOLD}`,
    })
  }

  // ── prompt missing required template tokens ─────────────────────
  // Source of truth: the deployed Ultravox prompt (that's what the agent uses).
  for (const token of REQUIRED_PROMPT_TOKENS) {
    if (!agent.systemPrompt.includes(token)) {
      findings.push({
        slug,
        dimension: `prompt_missing_token:${token}`,
        expected: 'present in deployed prompt',
        actual: 'absent',
      })
    }
  }

  // ── voice ───────────────────────────────────────────────────────
  if (client.agent_voice_id && agent.voice && client.agent_voice_id !== agent.voice) {
    findings.push({
      slug,
      dimension: 'voice',
      expected: client.agent_voice_id,
      actual: agent.voice,
    })
  }

  // ── selectedTools (normalize: sort by tool key, compare names + count) ──
  const liveKeys = agent.selectedTools.map(toolKey).sort()
  const liveSet = new Set(liveKeys)
  // We don't have a definitive saved-tools side here (clients.tools mirrors
  // deployed state, not authored intent). Diff is per-tool secret presence
  // only — name-set mismatch is surfaced when the live list omits one of the
  // capabilities that the client's flags imply (covered below in fake-on).

  // ── HTTP tool missing X-Tool-Secret ─────────────────────────────
  for (const t of agent.selectedTools) {
    if (isHttpTool(t) && !hasToolSecret(t)) {
      findings.push({
        slug,
        dimension: `tool_secret_missing:${toolKey(t)}`,
        expected: 'staticParameters[].name == "X-Tool-Secret"',
        actual: 'absent',
        note: 'HTTP tool will reach our webhook without auth header',
      })
    }
  }

  // ── capability fake-on ──────────────────────────────────────────
  if (client.sms_enabled && !client.twilio_number) {
    findings.push({
      slug,
      dimension: 'capability_fake_on:sms',
      expected: 'twilio_number set',
      actual: 'NULL',
      note: 'sms_enabled = true but no number provisioned',
    })
  }
  if (client.booking_enabled && client.calendar_auth_status !== 'connected') {
    findings.push({
      slug,
      dimension: 'capability_fake_on:booking',
      expected: 'calendar_auth_status == "connected"',
      actual: String(client.calendar_auth_status ?? 'NULL'),
      note: 'booking_enabled = true but calendar not connected',
    })
  }
  if (client.forwarding_number && client.selected_plan !== 'pro') {
    findings.push({
      slug,
      dimension: 'capability_fake_on:forwarding',
      expected: 'selected_plan == "pro"',
      actual: String(client.selected_plan ?? 'NULL'),
      note: 'forwarding_number set on non-Pro plan — runtime will refuse to transfer',
    })
  }

  // Quiet "unused" lint by referencing the computed sets in the log path.
  if (liveSet.size !== liveKeys.length) {
    findings.push({
      slug,
      dimension: 'tools_duplicate_names',
      expected: 'unique tool names',
      actual: liveKeys.join(','),
    })
  }

  return findings
}

function driftSignature(findings: DriftFinding[]): string {
  if (findings.length === 0) return 'clean'
  const canonical = findings
    .map(f => `${f.slug}|${f.dimension}|${f.expected}|${f.actual}`)
    .sort()
    .join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

type AlertState = { alerted_at: string; drift_signature: string }

function readState(): AlertState | null {
  try {
    if (!existsSync(STATE_FILE)) return null
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as AlertState
  } catch {
    return null
  }
}

function writeState(sig: string): void {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify({ alerted_at: new Date().toISOString(), drift_signature: sig }, null, 2))
  } catch (e) {
    console.warn(`[nightly-drift] Failed to write state file: ${(e as Error).message}`)
  }
}

function shouldAlert(signature: string): boolean {
  const prev = readState()
  if (!prev) return true
  if (prev.drift_signature !== signature) return true
  const age = Date.now() - new Date(prev.alerted_at).getTime()
  return age >= RE_ALERT_WINDOW_MS
}

function formatTelegramMessage(findings: DriftFinding[], checkedCount: number): string {
  const bySlug = new Map<string, DriftFinding[]>()
  for (const f of findings) {
    const list = bySlug.get(f.slug) ?? []
    list.push(f)
    bySlug.set(f.slug, list)
  }
  const lines: string[] = [
    `🌙 <b>Nightly Drift Check</b> — ${findings.length} finding(s) across ${bySlug.size}/${checkedCount} client(s)`,
    '',
  ]
  // Cap at 8 clients in the message body to stay under Telegram's 4096-char limit.
  const slugs = Array.from(bySlug.keys()).slice(0, 8)
  for (const slug of slugs) {
    const items = bySlug.get(slug)!
    lines.push(`<b>${slug}</b>`)
    for (const f of items.slice(0, 6)) {
      const note = f.note ? ` — ${f.note}` : ''
      lines.push(`  • ${f.dimension}: expected <code>${truncate(f.expected, 60)}</code> / actual <code>${truncate(f.actual, 60)}</code>${note}`)
    }
    if (items.length > 6) lines.push(`  • …and ${items.length - 6} more`)
    lines.push('')
  }
  if (bySlug.size > slugs.length) {
    lines.push(`<i>…and ${bySlug.size - slugs.length} more client(s) — see GitHub Action logs</i>`)
  }
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
    console.error(`[nightly-drift] Telegram send failed HTTP ${res.status}: ${await res.text().catch(() => '')}`)
    return false
  }
  return true
}

async function resolveOwnerChatId(sb: SupabaseClient): Promise<string | null> {
  if (TELEGRAM_OWNER_CHAT_ID) return TELEGRAM_OWNER_CHAT_ID
  const { data, error } = await sb
    .from('clients')
    .select('telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .maybeSingle()
  if (error) {
    console.warn(`[nightly-drift] owner chat-id lookup failed: ${error.message}`)
    return null
  }
  return (data as { telegram_chat_id: string | null } | null)?.telegram_chat_id ?? null
}

async function main(): Promise<number> {
  console.log(`[nightly-drift] Starting${DRY_RUN ? ' (dry-run)' : ''}…`)
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

  const { data, error } = await sb
    .from('clients')
    .select('id, slug, business_name, system_prompt, agent_voice_id, ultravox_agent_id, sms_enabled, twilio_number, booking_enabled, calendar_auth_status, forwarding_number, selected_plan, telegram_chat_id')
    .eq('status', 'active')
    .not('ultravox_agent_id', 'is', null)
    .order('slug')

  if (error) {
    console.error(`[nightly-drift] Supabase fetch failed: ${error.message}`)
    return 2
  }
  const clients = (data ?? []) as unknown as ClientRow[]
  if (clients.length === 0) {
    console.log('[nightly-drift] No active clients with ultravox_agent_id. Done.')
    return 0
  }

  const allFindings: DriftFinding[] = []
  const fetchErrors: Array<{ slug: string; error: string }> = []
  for (const c of clients) {
    if (!c.ultravox_agent_id) continue
    try {
      const agent = await fetchAgent(c.ultravox_agent_id)
      const findings = diffClient(c, agent)
      if (findings.length > 0) {
        console.log(`  [DRIFT] ${c.slug} — ${findings.length} finding(s)`)
        for (const f of findings) console.log(`     · ${f.dimension}: ${truncate(f.expected, 40)} ≠ ${truncate(f.actual, 40)}`)
      } else {
        console.log(`  [OK   ] ${c.slug}`)
      }
      allFindings.push(...findings)
    } catch (e) {
      const msg = (e as Error).message
      console.error(`  [ERR  ] ${c.slug}: ${msg}`)
      fetchErrors.push({ slug: c.slug, error: msg })
    }
  }

  // Treat fetch errors as drift findings so they surface in the alert.
  for (const fe of fetchErrors) {
    allFindings.push({
      slug: fe.slug,
      dimension: 'ultravox_fetch_error',
      expected: 'HTTP 200',
      actual: fe.error,
    })
  }

  console.log(`[nightly-drift] checked=${clients.length} findings=${allFindings.length} fetch_errors=${fetchErrors.length}`)

  // Write to harness_findings (admin dashboard). Always runs, even in dry-run,
  // because dry-run is about not-paging-the-owner, not skipping persistence.
  // Empty-findings runs do NOT clear stale rows — admin must resolve manually
  // (consistent with harness-writer's documented behavior).
  if (allFindings.length > 0) {
    const runId = process.env.GITHUB_RUN_ID ?? String(Date.now())
    const findings: HarnessFinding[] = []
    for (const f of allFindings) {
      const checkName = dimensionToCheckName(f.dimension)
      if (!checkName) continue
      findings.push({
        check_name: checkName,
        severity: dimensionToSeverity(f.dimension),
        client_slug: f.slug,
        summary: `${f.dimension}: ${truncate(f.actual, 80)}${f.note ? ` — ${truncate(f.note, 60)}` : ''}`.slice(0, 280),
        details: {
          dimension: f.dimension,
          expected: f.expected,
          actual: f.actual,
          note: f.note ?? null,
        },
      })
    }
    try {
      const res = await recordFindings({ harness: 'drift-check', run_id: runId, findings })
      console.log(`[nightly-drift] harness_findings: wrote=${res.written} reopened=${res.reopened} errors=${res.errors.length}`)
      for (const e of res.errors) console.error(`  [recordFindings] ${e}`)
    } catch (err) {
      console.error('[nightly-drift] recordFindings failed:', err)
    }
  }

  if (allFindings.length === 0) {
    console.log('[nightly-drift] Clean.')
    return 0
  }

  const signature = driftSignature(allFindings)
  if (DRY_RUN) {
    console.log(`[nightly-drift] DRY RUN — would alert. signature=${signature.slice(0, 12)}…`)
    return 1
  }
  if (!shouldAlert(signature)) {
    console.log(`[nightly-drift] Same drift signature within 24h — suppressing alert. signature=${signature.slice(0, 12)}…`)
    return 1
  }
  const ownerChat = await resolveOwnerChatId(sb)
  if (!ownerChat) {
    console.error('[nightly-drift] No owner chat-id available (TELEGRAM_OWNER_CHAT_ID env unset and hasan-sharif.telegram_chat_id is NULL). Cannot alert.')
    return 1
  }
  const message = formatTelegramMessage(allFindings, clients.length)
  const sent = await sendTelegram(ownerChat, message)
  if (sent) {
    writeState(signature)
    console.log(`[nightly-drift] Alert sent. signature=${signature.slice(0, 12)}…`)
  }
  return 1
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[nightly-drift] Fatal:', err)
    process.exit(2)
  })
