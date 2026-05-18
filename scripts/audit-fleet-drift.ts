/**
 * Fleet Drift Detector v1 — unmissed.ai
 *
 * Read-only audit that compares EXPECTED state vs ACTUAL state across
 * Supabase clients, Twilio number configs, and Ultravox agent configs.
 *
 * Run:
 *   railway run -- npx tsx scripts/audit-fleet-drift.ts
 *   OR (with .env.local populated):
 *   npx tsx scripts/audit-fleet-drift.ts
 *
 * Exit code 1 if any CRITICAL findings (cron-friendly).
 *
 * v1 scope: read-only. No auto-reconciliation. No Telegram alerts.
 * v2 (deferred): cron + auto-fix + Telegram alerts.
 *
 * Origin: 2026-05-17 domain-migration incident exposed fleet drift across
 * 5 dimensions (Twilio inventory, prompt-tool mismatch, slug-vs-business
 * mismatch, host mismatch, prompt-over-hard-max). This is the first pass
 * at making drift visible.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const REQUIRED_HOST = 'https://endvoicemail.ai'
const LEGACY_HOST = 'https://unmissed-ai-production.up.railway.app'
const PROMPT_CHAR_HARD_MAX = 21000
const LAST_SYNC_STALE_DAYS = 14
const PROPERTY_MGMT_NICHES = ['property_management', 'property-management']

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface Finding {
  severity: Severity
  client_slug: string
  dimension: string
  expected: string
  actual: string
  note?: string
}

interface ClientRow {
  id: string
  slug: string
  business_name: string | null
  agent_name: string | null
  twilio_number: string | null
  ultravox_agent_id: string | null
  niche: string | null
  system_prompt: string | null
  tools: unknown[] | null
  last_agent_sync_at: string | null
  status: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY!

async function fetchAllTwilioNumbers(): Promise<Array<{ phoneNumber: string; voiceUrl: string | null; voiceFallbackUrl: string | null; smsUrl: string | null; sid: string }>> {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { Authorization: `Basic ${auth}` } },
  )
  if (!res.ok) throw new Error(`Twilio list failed: ${res.status}`)
  const data: { incoming_phone_numbers: Array<{ phone_number: string; voice_url: string | null; voice_fallback_url: string | null; sms_url: string | null; sid: string }> } = await res.json()
  return data.incoming_phone_numbers.map(n => ({
    phoneNumber: n.phone_number,
    voiceUrl: n.voice_url,
    voiceFallbackUrl: n.voice_fallback_url,
    smsUrl: n.sms_url,
    sid: n.sid,
  }))
}

interface UltravoxToolEntry {
  toolId?: string
  nameOverride?: string
  temporaryTool?: {
    modelToolName?: string
    http?: { baseUrlPattern?: string }
  }
}

async function fetchUltravoxAgent(agentId: string): Promise<{ name: string; selectedTools: UltravoxToolEntry[] }> {
  const res = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
    headers: { 'X-API-Key': ULTRAVOX_KEY },
  })
  if (!res.ok) throw new Error(`Ultravox fetch failed for ${agentId}: ${res.status}`)
  const data: { name: string; callTemplate: { selectedTools: UltravoxToolEntry[] } } = await res.json()
  return { name: data.name, selectedTools: data.callTemplate?.selectedTools ?? [] }
}

function toolName(t: UltravoxToolEntry): string {
  return t.temporaryTool?.modelToolName ?? t.nameOverride ?? '(unknown)'
}

function toolUrl(t: UltravoxToolEntry): string | undefined {
  return t.temporaryTool?.http?.baseUrlPattern
}

interface ToolsConfigEntry {
  temporaryTool?: {
    modelToolName?: string
    http?: { baseUrlPattern?: string }
  }
  toolId?: string
  nameOverride?: string
}

function auditClient(
  client: ClientRow,
  twilioByPhone: Map<string, { voiceUrl: string | null; voiceFallbackUrl: string | null; smsUrl: string | null }>,
  agent: { name: string; selectedTools: UltravoxToolEntry[] } | null,
): Finding[] {
  const findings: Finding[] = []
  const slug = client.slug
  const expectedVoicePath = `/api/webhook/${slug}/inbound`
  const expectedFallbackPath = `/api/webhook/${slug}/fallback`
  const expectedSmsPath = `/api/webhook/${slug}/sms-inbound`

  // ── Twilio config ───────────────────────────────────────────────
  if (client.twilio_number) {
    const tw = twilioByPhone.get(client.twilio_number)
    if (!tw) {
      findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: 'twilio_number_missing', expected: client.twilio_number, actual: '(not found on Twilio account)' })
    } else {
      for (const [field, expectedPath, actual] of [
        ['voice_url', expectedVoicePath, tw.voiceUrl],
        ['voice_fallback_url', expectedFallbackPath, tw.voiceFallbackUrl],
        ['sms_url', expectedSmsPath, tw.smsUrl],
      ] as const) {
        if (!actual) {
          if (field === 'voice_url') findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: `twilio_${field}`, expected: `${REQUIRED_HOST}${expectedPath}`, actual: '(empty)' })
          continue
        }
        if (!actual.startsWith(REQUIRED_HOST)) {
          const sev: Severity = field === 'voice_url' ? 'CRITICAL' : 'HIGH'
          findings.push({ severity: sev, client_slug: slug, dimension: `twilio_${field}_host`, expected: REQUIRED_HOST, actual: new URL(actual).origin, note: actual.startsWith(LEGACY_HOST) ? 'legacy Railway host' : 'unknown host' })
        }
        if (!actual.includes(`/${slug}/`)) {
          findings.push({ severity: 'HIGH', client_slug: slug, dimension: `twilio_${field}_slug`, expected: `…/${slug}/…`, actual })
        }
      }
    }
  }

  // ── Supabase clients.tools[].baseUrlPattern ──────────────────────
  if (Array.isArray(client.tools)) {
    for (const tool of client.tools as ToolsConfigEntry[]) {
      const url = tool.temporaryTool?.http?.baseUrlPattern
      if (!url) continue
      if (!url.startsWith(REQUIRED_HOST)) {
        findings.push({ severity: 'HIGH', client_slug: slug, dimension: `supabase_tool_host:${tool.temporaryTool?.modelToolName ?? '?'}`, expected: REQUIRED_HOST, actual: new URL(url).origin })
      }
      if (!url.includes(`/${slug}/`)) {
        findings.push({ severity: 'HIGH', client_slug: slug, dimension: `supabase_tool_slug:${tool.temporaryTool?.modelToolName ?? '?'}`, expected: `…/${slug}/…`, actual: url })
      }
    }
  }

  // ── Prompt length ───────────────────────────────────────────────
  const promptLen = client.system_prompt?.length ?? 0
  if (promptLen > PROMPT_CHAR_HARD_MAX) {
    findings.push({ severity: 'HIGH', client_slug: slug, dimension: 'prompt_length', expected: `≤ ${PROMPT_CHAR_HARD_MAX} chars`, actual: `${promptLen} chars`, note: 'Promote content to KB or trim niche template' })
  }

  // ── last_agent_sync_at recency ───────────────────────────────────
  if (client.last_agent_sync_at) {
    const ageMs = Date.now() - new Date(client.last_agent_sync_at).getTime()
    const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24))
    if (ageDays > LAST_SYNC_STALE_DAYS) {
      findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: 'last_agent_sync_at', expected: `≤ ${LAST_SYNC_STALE_DAYS} days old`, actual: `${ageDays} days old`, note: 'May indicate stored Ultravox state has diverged from Supabase prompt' })
    }
  } else {
    findings.push({ severity: 'LOW', client_slug: slug, dimension: 'last_agent_sync_at', expected: 'non-null', actual: 'NULL', note: 'Never synced via tracked path' })
  }

  // ── Ultravox agent stored tools ─────────────────────────────────
  if (!agent) {
    findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: 'ultravox_agent', expected: 'agent fetchable', actual: '(fetch failed)' })
  } else {
    const agentToolNames = new Set(agent.selectedTools.map(toolName))

    // Property-mgmt: prompt mentions submitMaintenanceRequest ⇔ agent has the tool
    if (PROPERTY_MGMT_NICHES.includes(client.niche ?? '')) {
      const promptMentions = client.system_prompt?.includes('submitMaintenanceRequest') ?? false
      const agentHas = agentToolNames.has('submitMaintenanceRequest')
      if (promptMentions && !agentHas) {
        findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: 'prompt_tool_mismatch:submitMaintenanceRequest', expected: 'tool in agent.selectedTools', actual: 'absent', note: 'Prompt instructs agent to call this tool. Phantom branch — caller hears the agent say she\'ll flag it but nothing actually fires.' })
      }
      if (!promptMentions && agentHas) {
        findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: 'prompt_tool_mismatch:submitMaintenanceRequest', expected: 'tool referenced in prompt', actual: 'absent in prompt', note: 'Agent has the capability but prompt never instructs use. Wasted tool registration.' })
      }
    }

    // Tool URL host on stored agent config
    for (const t of agent.selectedTools) {
      const url = toolUrl(t)
      if (!url) continue
      if (!url.startsWith(REQUIRED_HOST)) {
        findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: `ultravox_tool_host:${toolName(t)}`, expected: REQUIRED_HOST, actual: new URL(url).origin, note: 'Stored agent tool URL. Note: clients.tools toolOverrides win at call time; this is hygiene.' })
      }
      if (!url.includes(`/${slug}/`)) {
        findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: `ultravox_tool_slug:${toolName(t)}`, expected: `…/${slug}/…`, actual: url })
      }
    }
  }

  return findings
}

function formatReport(findings: Finding[], clientCount: number): string {
  const bySev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of findings) bySev[f.severity]++

  const lines: string[] = []
  lines.push(`# Fleet Drift Report — ${new Date().toISOString()}`)
  lines.push('')
  lines.push('**Scope:** ' + clientCount + ' active clients with `twilio_number` + `ultravox_agent_id` set')
  lines.push(`**Findings:** ${findings.length} total — CRITICAL ${bySev.CRITICAL} | HIGH ${bySev.HIGH} | MEDIUM ${bySev.MEDIUM} | LOW ${bySev.LOW}`)
  lines.push('')

  if (findings.length === 0) {
    lines.push('No drift detected. Fleet is clean.')
    return lines.join('\n')
  }

  // Group by severity
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  for (const sev of order) {
    const subset = findings.filter(f => f.severity === sev)
    if (subset.length === 0) continue
    lines.push(`## ${sev} (${subset.length})`)
    lines.push('')
    lines.push('| Client | Dimension | Expected | Actual | Note |')
    lines.push('|---|---|---|---|---|')
    for (const f of subset) {
      const note = (f.note ?? '').replace(/\|/g, '\\|')
      lines.push(`| \`${f.client_slug}\` | ${f.dimension} | ${truncate(f.expected, 60)} | ${truncate(f.actual, 60)} | ${truncate(note, 80)} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

async function main(): Promise<void> {
  console.log('[drift-detector] Fetching active clients from Supabase…')
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, slug, business_name, agent_name, twilio_number, ultravox_agent_id, niche, system_prompt, tools, last_agent_sync_at, status')
    .eq('status', 'active')
    .not('twilio_number', 'is', null)
    .not('ultravox_agent_id', 'is', null)
    .order('slug')

  if (error) {
    console.error('[drift-detector] Supabase error:', error.message)
    process.exit(2)
  }
  if (!clients || clients.length === 0) {
    console.log('[drift-detector] No active clients found.')
    process.exit(0)
  }

  console.log(`[drift-detector] Found ${clients.length} active clients. Fetching Twilio numbers…`)
  const twilioNumbers = await fetchAllTwilioNumbers()
  const twilioByPhone = new Map(twilioNumbers.map(n => [n.phoneNumber, { voiceUrl: n.voiceUrl, voiceFallbackUrl: n.voiceFallbackUrl, smsUrl: n.smsUrl }]))
  console.log(`[drift-detector] Fetched ${twilioNumbers.length} Twilio numbers.`)

  const allFindings: Finding[] = []
  for (const c of clients as unknown as ClientRow[]) {
    let agent: { name: string; selectedTools: UltravoxToolEntry[] } | null = null
    try {
      agent = await fetchUltravoxAgent(c.ultravox_agent_id!)
    } catch (e) {
      console.error(`[drift-detector] ${c.slug}: agent fetch failed:`, (e as Error).message)
    }
    const findings = auditClient(c, twilioByPhone, agent)
    allFindings.push(...findings)
    console.log(`[drift-detector] ${c.slug}: ${findings.length} finding(s)`)
  }

  const report = formatReport(allFindings, clients.length)
  console.log('')
  console.log(report)
  console.log('')

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `/tmp/drift-report-${ts}.md`
  writeFileSync(path, report)
  console.log(`[drift-detector] Report saved: ${path}`)

  const criticalCount = allFindings.filter(f => f.severity === 'CRITICAL').length
  if (criticalCount > 0) {
    console.error(`[drift-detector] ${criticalCount} CRITICAL finding(s) — exiting 1`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('[drift-detector] FATAL:', e)
  process.exit(2)
})
