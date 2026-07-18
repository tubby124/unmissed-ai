/**
 * Fleet Drift Detector — shared audit logic.
 *
 * Read-only audit. Computes EXPECTED state from `clients` table + niche/plan
 * conventions, fetches ACTUAL state from Twilio + live Ultravox + Supabase
 * `clients.tools`, returns Findings[]. Used by:
 *   - scripts/audit-fleet-drift.ts (local CLI)
 *   - src/app/api/cron/fleet-drift/route.ts (Railway cron + Telegram alert)
 *
 * Origin: 2026-05-17 domain-migration incident exposed multi-surface drift
 * across the fleet (Twilio inventory, prompt-vs-tool mismatch, host mismatch,
 * prompt-over-hard-max). See vault note + D427.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { PROMPT_CHAR_HARD_MAX } from './knowledge-summary'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Finding {
  severity: Severity
  client_slug: string
  dimension: string
  expected: string
  actual: string
  note?: string
}

export interface FleetReport {
  clients_audited: number
  findings: Finding[]
  errors: Array<{ slug: string; error: string }>
}

const REQUIRED_HOST = 'https://endvoicemail.ai'
// Must match current production fallback wiring.
const SHARED_VOICE_FALLBACK_URL = 'https://fallback.endvoicemail.ai/voice'
const LAST_SYNC_STALE_DAYS = 14
const PROPERTY_MGMT_NICHES = ['property_management', 'property-management']

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

interface TwilioNumber {
  phoneNumber: string
  voiceUrl: string | null
  voiceFallbackUrl: string | null
  smsUrl: string | null
}

type TwilioUrls = Pick<TwilioNumber, 'voiceUrl' | 'voiceFallbackUrl' | 'smsUrl'>

/** Pure URL audit. The voice fallback intentionally uses an independent CF Worker. */
export function auditTwilioUrls(slug: string, urls: TwilioUrls): Finding[] {
  const findings: Finding[] = []
  const primaryUrls = [
    ['voice_url', `/api/webhook/${slug}/inbound`, urls.voiceUrl],
    ['sms_url', `/api/webhook/${slug}/sms-inbound`, urls.smsUrl],
  ] as const

  for (const [field, expectedPath, actual] of primaryUrls) {
    if (!actual) {
      if (field === 'voice_url') {
        findings.push({
          severity: 'CRITICAL',
          client_slug: slug,
          dimension: `twilio_${field}`,
          expected: `${REQUIRED_HOST}${expectedPath}`,
          actual: '(empty)',
        })
      }
      continue
    }

    if (!actual.startsWith(REQUIRED_HOST)) {
      findings.push({
        severity: field === 'voice_url' ? 'CRITICAL' : 'HIGH',
        client_slug: slug,
        dimension: `twilio_${field}_host`,
        expected: REQUIRED_HOST,
        actual: safeOrigin(actual),
        note: 'unexpected host',
      })
    }
    if (!actual.includes(`/${slug}/`)) {
      findings.push({
        severity: 'HIGH',
        client_slug: slug,
        dimension: `twilio_${field}_slug`,
        expected: `…/${slug}/…`,
        actual,
      })
    }
  }

  if (urls.voiceFallbackUrl !== SHARED_VOICE_FALLBACK_URL) {
    findings.push({
      severity: 'HIGH',
      client_slug: slug,
      dimension: 'twilio_voice_fallback_url',
      expected: SHARED_VOICE_FALLBACK_URL,
      actual: urls.voiceFallbackUrl ?? '(empty)',
      note: 'fallback must use the independent Cloudflare Worker',
    })
  }

  return findings
}

/** Pure prompt-length audit using the same hard limit as runtime provisioning. */
export function auditPromptLength(slug: string, promptLen: number): Finding[] {
  if (promptLen <= PROMPT_CHAR_HARD_MAX) return []
  return [{
    severity: 'HIGH',
    client_slug: slug,
    dimension: 'prompt_length',
    expected: `≤ ${PROMPT_CHAR_HARD_MAX} chars`,
    actual: `${promptLen} chars`,
    note: 'Promote content to KB or trim niche template',
  }]
}

interface UltravoxToolEntry {
  toolId?: string
  nameOverride?: string
  temporaryTool?: {
    modelToolName?: string
    http?: { baseUrlPattern?: string }
  }
}

interface ToolsConfigEntry {
  temporaryTool?: {
    modelToolName?: string
    http?: { baseUrlPattern?: string }
  }
  toolId?: string
  nameOverride?: string
}

function toolName(t: UltravoxToolEntry): string {
  return t.temporaryTool?.modelToolName ?? t.nameOverride ?? '(unknown)'
}

function toolUrl(t: UltravoxToolEntry): string | undefined {
  return t.temporaryTool?.http?.baseUrlPattern
}

async function fetchAllTwilioNumbers(sid: string, token: string): Promise<TwilioNumber[]> {
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`Twilio list failed: ${res.status}`)
  const data: {
    incoming_phone_numbers: Array<{
      phone_number: string
      voice_url: string | null
      voice_fallback_url: string | null
      sms_url: string | null
    }>
  } = await res.json()
  return data.incoming_phone_numbers.map(n => ({
    phoneNumber: n.phone_number,
    voiceUrl: n.voice_url,
    voiceFallbackUrl: n.voice_fallback_url,
    smsUrl: n.sms_url,
  }))
}

async function fetchUltravoxAgent(
  agentId: string,
  apiKey: string,
): Promise<{ name: string; selectedTools: UltravoxToolEntry[] }> {
  const res = await fetch(`https://api.ultravox.ai/api/agents/${agentId}`, {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Ultravox fetch failed for ${agentId}: ${res.status}`)
  const data: { name: string; callTemplate: { selectedTools: UltravoxToolEntry[] } } = await res.json()
  return { name: data.name, selectedTools: data.callTemplate?.selectedTools ?? [] }
}

function auditClient(
  client: ClientRow,
  twilioByPhone: Map<string, TwilioNumber>,
  agent: { name: string; selectedTools: UltravoxToolEntry[] } | null,
): Finding[] {
  const findings: Finding[] = []
  const slug = client.slug

  // ── Twilio config ───────────────────────────────────────────────
  if (client.twilio_number) {
    const tw = twilioByPhone.get(client.twilio_number)
    if (!tw) {
      findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: 'twilio_number_missing', expected: client.twilio_number, actual: '(not found on Twilio account)' })
    } else {
      findings.push(...auditTwilioUrls(slug, tw))
    }
  }

  // ── Supabase clients.tools[].baseUrlPattern (RUNTIME-AUTHORITATIVE) ─
  if (Array.isArray(client.tools)) {
    for (const tool of client.tools as ToolsConfigEntry[]) {
      const url = tool.temporaryTool?.http?.baseUrlPattern
      if (!url) continue
      if (!url.startsWith(REQUIRED_HOST)) {
        findings.push({ severity: 'HIGH', client_slug: slug, dimension: `supabase_tool_host:${tool.temporaryTool?.modelToolName ?? '?'}`, expected: REQUIRED_HOST, actual: safeOrigin(url) })
      }
      if (!url.includes(`/${slug}/`)) {
        findings.push({ severity: 'HIGH', client_slug: slug, dimension: `supabase_tool_slug:${tool.temporaryTool?.modelToolName ?? '?'}`, expected: `…/${slug}/…`, actual: url })
      }
    }
  }

  // ── Prompt length ───────────────────────────────────────────────
  findings.push(...auditPromptLength(slug, client.system_prompt?.length ?? 0))

  // ── last_agent_sync_at recency ───────────────────────────────────
  if (client.last_agent_sync_at) {
    const ageMs = Date.now() - new Date(client.last_agent_sync_at).getTime()
    const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24))
    if (ageDays > LAST_SYNC_STALE_DAYS) {
      findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: 'last_agent_sync_at', expected: `≤ ${LAST_SYNC_STALE_DAYS} days old`, actual: `${ageDays} days old` })
    }
  } else {
    findings.push({ severity: 'LOW', client_slug: slug, dimension: 'last_agent_sync_at', expected: 'non-null', actual: 'NULL', note: 'Never synced via tracked path' })
  }

  // ── Property-mgmt: prompt mentions submitMaintenanceRequest ⇔ clients.tools has it ─
  if (PROPERTY_MGMT_NICHES.includes(client.niche ?? '')) {
    const promptMentions = client.system_prompt?.includes('submitMaintenanceRequest') ?? false
    const supabaseHas = Array.isArray(client.tools) && (client.tools as ToolsConfigEntry[]).some(
      t => t.temporaryTool?.modelToolName === 'submitMaintenanceRequest',
    )
    if (promptMentions && !supabaseHas) {
      findings.push({ severity: 'CRITICAL', client_slug: slug, dimension: 'prompt_tool_mismatch:submitMaintenanceRequest', expected: 'tool in clients.tools (runtime source via toolOverrides)', actual: 'absent', note: 'Prompt instructs agent to call this tool. Phantom branch — caller hears the agent say she will flag it but nothing actually fires.' })
    }
    if (!promptMentions && supabaseHas) {
      findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: 'prompt_tool_mismatch:submitMaintenanceRequest', expected: 'tool referenced in prompt', actual: 'absent in prompt', note: 'Agent has the capability but prompt never instructs use.' })
    }
  }

  // ── Ultravox agent stored tools (HYGIENE — toolOverrides win at call time) ─
  if (agent) {
    for (const t of agent.selectedTools) {
      const url = toolUrl(t)
      if (!url) continue
      if (!url.startsWith(REQUIRED_HOST)) {
        findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: `ultravox_tool_host:${toolName(t)}`, expected: REQUIRED_HOST, actual: safeOrigin(url), note: 'Stored agent tool URL. clients.tools toolOverrides win at call time; this is hygiene.' })
      }
      if (!url.includes(`/${slug}/`)) {
        findings.push({ severity: 'MEDIUM', client_slug: slug, dimension: `ultravox_tool_slug:${toolName(t)}`, expected: `…/${slug}/…`, actual: url })
      }
    }
  }

  return findings
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/**
 * Audit the fleet. Read-only. Returns Findings[] + per-client error list.
 */
export async function auditFleet(
  svc: SupabaseClient,
  opts: { twilioSid: string; twilioToken: string; ultravoxApiKey: string },
): Promise<FleetReport> {
  const { data: clientsRaw, error } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, twilio_number, ultravox_agent_id, niche, system_prompt, tools, last_agent_sync_at, status')
    .eq('status', 'active')
    .not('twilio_number', 'is', null)
    .not('ultravox_agent_id', 'is', null)
    .order('slug')
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`)

  const clients = (clientsRaw ?? []) as unknown as ClientRow[]
  if (clients.length === 0) return { clients_audited: 0, findings: [], errors: [] }

  const twilioNumbers = await fetchAllTwilioNumbers(opts.twilioSid, opts.twilioToken)
  const twilioByPhone = new Map(twilioNumbers.map(n => [n.phoneNumber, n]))

  const allFindings: Finding[] = []
  const errors: Array<{ slug: string; error: string }> = []

  for (const c of clients) {
    let agent: { name: string; selectedTools: UltravoxToolEntry[] } | null = null
    try {
      agent = await fetchUltravoxAgent(c.ultravox_agent_id!, opts.ultravoxApiKey)
    } catch (e) {
      errors.push({ slug: c.slug, error: (e as Error).message })
    }
    allFindings.push(...auditClient(c, twilioByPhone, agent))
  }

  return { clients_audited: clients.length, findings: allFindings, errors }
}

/**
 * Compact markdown summary for human consumption (CLI, Telegram, logs).
 */
export function formatFleetReport(report: FleetReport): string {
  const bySev: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of report.findings) bySev[f.severity]++

  const lines: string[] = []
  lines.push(`# Fleet Drift Report — ${new Date().toISOString()}`)
  lines.push('')
  lines.push(`Scope: ${report.clients_audited} active clients with twilio_number + ultravox_agent_id`)
  lines.push(`Findings: ${report.findings.length} (CRITICAL ${bySev.CRITICAL} | HIGH ${bySev.HIGH} | MEDIUM ${bySev.MEDIUM} | LOW ${bySev.LOW})`)
  if (report.errors.length > 0) {
    lines.push(`Errors: ${report.errors.length}`)
    for (const e of report.errors) lines.push(`  - ${e.slug}: ${e.error}`)
  }
  lines.push('')

  if (report.findings.length === 0) {
    lines.push('No drift detected. Fleet is clean.')
    return lines.join('\n')
  }

  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  for (const sev of order) {
    const subset = report.findings.filter(f => f.severity === sev)
    if (subset.length === 0) continue
    lines.push(`## ${sev} (${subset.length})`)
    for (const f of subset) {
      const note = f.note ? ` — ${truncate(f.note, 80)}` : ''
      lines.push(`- \`${f.client_slug}\` ${f.dimension}: expected ${truncate(f.expected, 50)} / actual ${truncate(f.actual, 50)}${note}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
