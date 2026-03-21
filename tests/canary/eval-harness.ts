#!/usr/bin/env npx tsx
/**
 * eval-harness.ts — S8 Canary Eval Harness
 *
 * Automated DB-level checks for path parity and regression detection.
 * Queries Supabase directly to catch drift, stale state, and missing audit data.
 *
 * Checks:
 *   S8a — Rate limit: verifies cooldown logic constants match across code paths
 *   S8b — Audit trail: finds prompt_versions rows with null audit columns
 *   S8c — Stale knowledge tool: finds clients with queryKnowledge in tools
 *         but 0 approved chunks
 *
 * Usage:
 *   npx tsx tests/canary/eval-harness.ts
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars
 * (from Railway or local .env.local)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  console.error('Set them via Railway CLI, .env.local, or export directly.')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY)

interface CheckResult {
  name: string
  status: 'PASS' | 'WARN' | 'FAIL'
  details: string
}

const results: CheckResult[] = []

function log(r: CheckResult) {
  const icon = r.status === 'PASS' ? '  PASS' : r.status === 'WARN' ? '  WARN' : '  FAIL'
  console.log(`${icon}  ${r.name}`)
  if (r.details) console.log(`        ${r.details}`)
  results.push(r)
}

// ── S8b: Audit trail — find prompt_versions with null audit columns ──────────

async function checkAuditTrail() {
  console.log('\n--- S8b: Prompt Versions Audit Trail ---')

  // Count total versions
  const { count: total } = await supa
    .from('prompt_versions')
    .select('id', { count: 'exact', head: true })

  // Count versions with null audit columns (post-S6 versions should never have nulls)
  // We check triggered_by_role since it should always be set (admin/owner/system)
  const { data: nullAudit } = await supa
    .from('prompt_versions')
    .select('id, client_id, version, created_at, triggered_by_user_id, triggered_by_role, char_count')
    .is('triggered_by_role', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const nullCount = nullAudit?.length ?? 0

  if (nullCount === 0) {
    log({
      name: 'Audit trail: all versions have triggered_by_role',
      status: 'PASS',
      details: `${total ?? 0} total versions, 0 with null audit columns`,
    })
  } else {
    // Check if ALL null-audit versions are pre-S6 (before the migration)
    // S6 was deployed on 2026-03-21, so versions before that are expected to have nulls
    const s6Date = new Date('2026-03-21T00:00:00Z')
    const postS6Nulls = nullAudit!.filter(v => new Date(v.created_at) > s6Date)

    if (postS6Nulls.length === 0) {
      log({
        name: 'Audit trail: null audit columns (pre-S6 only)',
        status: 'WARN',
        details: `${nullCount} pre-S6 versions have null audit columns (expected — backfill deferred to S7k). ${total! - nullCount} post-S6 versions are clean.`,
      })
    } else {
      log({
        name: 'Audit trail: POST-S6 versions with null audit columns',
        status: 'FAIL',
        details: `${postS6Nulls.length} versions created AFTER S6 migration have null triggered_by_role. IDs: ${postS6Nulls.map(v => `v${v.version}@${v.client_id?.slice(0, 8)}`).join(', ')}`,
      })
    }
  }

  // Check char_count consistency
  const { data: charMismatch } = await supa
    .from('prompt_versions')
    .select('id, version, char_count, content')
    .not('char_count', 'is', null)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (charMismatch) {
    const mismatches = charMismatch.filter(v => v.char_count !== v.content?.length)
    if (mismatches.length === 0) {
      log({
        name: 'Audit trail: char_count matches content length',
        status: 'PASS',
        details: `Verified ${charMismatch.length} recent versions`,
      })
    } else {
      log({
        name: 'Audit trail: char_count MISMATCH',
        status: 'FAIL',
        details: `${mismatches.length} versions have char_count != content.length: ${mismatches.map(v => `v${v.version}(${v.char_count} vs ${v.content?.length})`).join(', ')}`,
      })
    }
  }
}

// ── S8c: Stale knowledge tool detection ──────────────────────────────────────

async function checkStaleKnowledgeTools() {
  console.log('\n--- S8c: Stale Knowledge Tool Detection ---')

  // Get all active clients with their tools
  const { data: clients } = await supa
    .from('clients')
    .select('id, slug, status, tools, knowledge_backend')
    .eq('status', 'active')

  if (!clients || clients.length === 0) {
    log({
      name: 'Stale knowledge tools: no active clients',
      status: 'WARN',
      details: 'No active clients found',
    })
    return
  }

  for (const client of clients) {
    const toolsArr = Array.isArray(client.tools) ? client.tools : []
    const hasKnowledgeTool = toolsArr.some((t: any) =>
      t?.temporaryTool?.modelToolName === 'queryKnowledge'
    )

    if (!hasKnowledgeTool) continue // No knowledge tool registered — fine

    // Client has queryKnowledge — verify they have approved chunks
    const { count } = await supa
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'approved')

    const chunkCount = count ?? 0

    if (chunkCount > 0) {
      log({
        name: `Knowledge tool: ${client.slug}`,
        status: 'PASS',
        details: `queryKnowledge registered, ${chunkCount} approved chunks`,
      })
    } else {
      log({
        name: `STALE knowledge tool: ${client.slug}`,
        status: 'FAIL',
        details: `queryKnowledge registered but 0 approved chunks! Tool will return empty results. Fix: re-deploy agent or remove knowledge_backend.`,
      })
    }
  }

  // Also check: clients with knowledge_backend='pgvector' but NO knowledge tool
  const pgvectorClients = clients.filter(c => c.knowledge_backend === 'pgvector')
  for (const client of pgvectorClients) {
    const toolsArr = Array.isArray(client.tools) ? client.tools : []
    const hasKnowledgeTool = toolsArr.some((t: any) =>
      t?.temporaryTool?.modelToolName === 'queryKnowledge'
    )

    if (hasKnowledgeTool) continue // Already checked above

    const { count } = await supa
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'approved')

    const chunkCount = count ?? 0

    if (chunkCount > 0) {
      log({
        name: `Missing knowledge tool: ${client.slug}`,
        status: 'WARN',
        details: `knowledge_backend=pgvector, ${chunkCount} approved chunks, but queryKnowledge NOT in tools. Fix: re-deploy agent.`,
      })
    }
    // If no chunks AND no tool — that's correct, no warning needed
  }
}

// ── S8a: Rate limit sanity check (DB-level) ──────────────────────────────────

async function checkRateLimitState() {
  console.log('\n--- S8a: Rate Limit Sanity ---')

  // Check if any client has 2+ prompt_versions created within 5 minutes of each other
  // This would indicate a rate limit bypass
  const { data: clients } = await supa
    .from('clients')
    .select('id, slug')
    .eq('status', 'active')

  if (!clients) return

  for (const client of clients) {
    const { data: versions } = await supa
      .from('prompt_versions')
      .select('version, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!versions || versions.length < 2) continue

    // Check consecutive version timestamps
    let rapidFire = false
    for (let i = 0; i < versions.length - 1; i++) {
      const gap = new Date(versions[i].created_at).getTime() - new Date(versions[i + 1].created_at).getTime()
      if (gap < 5 * 60 * 1000 && gap > 0) { // less than 5 minutes apart
        rapidFire = true
        log({
          name: `Rate limit: ${client.slug}`,
          status: 'WARN',
          details: `v${versions[i].version} and v${versions[i + 1].version} are ${Math.round(gap / 1000)}s apart (< 5 min cooldown). May be pre-S6 or system-triggered.`,
        })
        break
      }
    }

    if (!rapidFire) {
      log({
        name: `Rate limit: ${client.slug}`,
        status: 'PASS',
        details: `No rapid-fire versions detected`,
      })
    }
  }
}

// ── Tool registration parity: clients.tools vs buildAgentTools expectation ──

async function checkToolParity() {
  console.log('\n--- S8 Bonus: Tool Registration Parity ---')

  const { data: clients } = await supa
    .from('clients')
    .select('id, slug, status, tools, booking_enabled, forwarding_number, sms_enabled, knowledge_backend')
    .eq('status', 'active')

  if (!clients) return

  for (const client of clients) {
    const toolsArr = Array.isArray(client.tools) ? client.tools : []
    const toolNames = toolsArr.map((t: any) => t?.temporaryTool?.modelToolName).filter(Boolean)

    const issues: string[] = []

    // Check: booking_enabled but no calendar tools
    if (client.booking_enabled && !toolNames.includes('checkCalendarAvailability')) {
      issues.push('booking_enabled=true but NO checkCalendarAvailability tool')
    }

    // Check: forwarding_number but no transferCall
    if (client.forwarding_number && !toolNames.includes('transferCall')) {
      issues.push('forwarding_number set but NO transferCall tool')
    }

    // Check: sms_enabled but no sendTextMessage
    if (client.sms_enabled && !toolNames.includes('sendTextMessage')) {
      issues.push('sms_enabled=true but NO sendTextMessage tool')
    }

    // Check: no hangUp (should always be present)
    if (!toolNames.includes('hangUp')) {
      issues.push('MISSING hangUp tool (should always be present)')
    }

    // Check: no coaching tool (should always be present for slugged clients)
    if (client.slug && !toolNames.includes('checkForCoaching')) {
      issues.push('MISSING checkForCoaching tool')
    }

    if (issues.length === 0) {
      log({
        name: `Tool parity: ${client.slug}`,
        status: 'PASS',
        details: `${toolNames.length} tools registered, all flags match`,
      })
    } else {
      log({
        name: `Tool parity: ${client.slug}`,
        status: 'FAIL',
        details: issues.join('; '),
      })
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== S8 Canary Eval Harness ===')
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Date: ${new Date().toISOString()}`)

  await checkAuditTrail()
  await checkStaleKnowledgeTools()
  await checkRateLimitState()
  await checkToolParity()

  // Summary
  console.log('\n=== Summary ===')
  const pass = results.filter(r => r.status === 'PASS').length
  const warn = results.filter(r => r.status === 'WARN').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}  TOTAL: ${results.length}`)

  if (fail > 0) {
    console.log('\nFAILED checks require action before deploying.')
    process.exit(1)
  } else if (warn > 0) {
    console.log('\nWARNINGS detected — review before deploying to additional clients.')
    process.exit(0)
  } else {
    console.log('\nAll checks passed.')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Eval harness crashed:', err)
  process.exit(2)
})
