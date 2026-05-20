/**
 * Fleet Drift Detector — CLI wrapper around src/lib/drift-detector.
 *
 * Read-only audit. Exit 1 on CRITICAL findings (cron-friendly when invoked
 * via the cron route; for local CLI just useful for shell scripting).
 *
 * Run:
 *   railway run -- npx tsx scripts/audit-fleet-drift.ts
 *   OR (with .env.local populated):
 *   npx tsx scripts/audit-fleet-drift.ts
 *
 * v1 dimensions checked:
 *  - Twilio voice/fallback/sms URL host + slug
 *  - Supabase clients.tools[].baseUrlPattern host + slug
 *  - system_prompt length vs PROMPT_CHAR_HARD_MAX
 *  - last_agent_sync_at recency
 *  - Property-mgmt prompt-vs-tool mismatch (submitMaintenanceRequest)
 *  - Ultravox stored tool URLs (hygiene; toolOverrides win at call time)
 *
 * The cron-deployed equivalent is POST /api/cron/fleet-drift (Telegram alert
 * on CRITICAL). Both use the same `auditFleet` lib.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { auditFleet, formatFleetReport, type Severity } from '../src/lib/drift-detector'

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const ultravoxApiKey = process.env.ULTRAVOX_API_KEY
  if (!url || !key || !twilioSid || !twilioToken || !ultravoxApiKey) {
    console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ULTRAVOX_API_KEY')
    process.exit(2)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  console.log('[drift-detector] auditing fleet…')
  const report = await auditFleet(supabase, { twilioSid, twilioToken, ultravoxApiKey })

  console.log(`[drift-detector] clients_audited=${report.clients_audited} findings=${report.findings.length} errors=${report.errors.length}`)
  for (const c of report.findings.reduce((m, f) => { m.set(f.client_slug, (m.get(f.client_slug) ?? 0) + 1); return m }, new Map<string, number>()).entries()) {
    console.log(`[drift-detector] ${c[0]}: ${c[1]} finding(s)`)
  }

  const markdown = formatFleetReport(report)
  console.log('')
  console.log(markdown)
  console.log('')

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `/tmp/drift-report-${ts}.md`
  writeFileSync(path, markdown)
  console.log(`[drift-detector] Report saved: ${path}`)

  const criticalCount = report.findings.filter(f => f.severity === ('CRITICAL' as Severity)).length
  if (criticalCount > 0) {
    console.error(`[drift-detector] ${criticalCount} CRITICAL finding(s) — exiting 1`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('[drift-detector] FATAL:', e)
  process.exit(2)
})
