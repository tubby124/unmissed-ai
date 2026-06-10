/**
 * Reseed Client Settings — backfill the fleet-wide pgvector gap.
 *
 * Until 2026-06-03, the only path that called `reseedKnowledgeFromSettings()`
 * was `PATCH /api/dashboard/settings`. Provision/trial and activate-client
 * wrote `business_facts` and `extra_qa` directly to the DB and never reseeded.
 * Result: 24 of 50 fleet clients had business_facts / extra_qa populated but
 * ZERO `'settings_edit'` chunks in pgvector. The agent's `queryKnowledge` tool
 * returned empty for questions the dashboard clearly answered.
 *
 * The structural fix lives in [provision/trial/route.ts] and [activate-client.ts] —
 * future onboardings won't hit this. This script back-fills existing clients.
 *
 * Usage:
 *   # Dry-run on one client (default — no writes)
 *   npx tsx scripts/reseed-client-settings.ts --slug calgary-property-leasing
 *
 *   # Actually fire the reseed for one client
 *   npx tsx scripts/reseed-client-settings.ts --slug calgary-property-leasing --live
 *
 *   # Dry-run on every client whose corpus-inspect reseed-state is 'never-ran' or 'partial'
 *   npx tsx scripts/reseed-client-settings.ts --all-actionable
 *
 *   # Actually back-fill every actionable client (the real fleet fix)
 *   npx tsx scripts/reseed-client-settings.ts --all-actionable --live
 *
 * Safety:
 *   - Default is dry-run (no writes). --live required to actually fire.
 *   - `reseedKnowledgeFromSettings()` is idempotent — it deletes ONLY 'settings_edit'
 *     source chunks before re-embedding, leaving 'website_scrape', 'compiled_import',
 *     'knowledge_doc' untouched.
 *   - Per Hasan-owned-repo authorization rules in CLAUDE.md, --live writes to the
 *     unmissed prod Supabase project are pre-authorized. This script does NOT
 *     touch Ultravox agents or system_prompts. Knowledge corpus only.
 *   - Skips hand_tuned=true clients by default unless --include-hand-tuned is passed.
 *     The hand_tuned protection is about prompts, not knowledge chunks, so this is
 *     mostly defensive — but the rule says "no redeploy" and reseeding could be
 *     interpreted as a deploy.
 *
 * Exit codes:
 *   0 — completed (dry-run, or --live with all successes)
 *   1 — completed with one or more failures
 *   2 — bad CLI args
 *   3 — fatal error (DB unreachable, etc.)
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { reseedKnowledgeFromSettings } from '../src/lib/embeddings'

interface CliArgs {
  slug: string | null
  allActionable: boolean
  live: boolean
  includeHandTuned: boolean
  json: boolean
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const args: CliArgs = { slug: null, allActionable: false, live: false, includeHandTuned: false, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--all-actionable') args.allActionable = true
    else if (a === '--live') args.live = true
    else if (a === '--include-hand-tuned') args.includeHandTuned = true
    else if (a === '--json') args.json = true
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    }
  }
  if (!args.slug && !args.allActionable) {
    printUsage()
    process.exit(2)
  }
  return args
}

function printUsage(): void {
  console.error('Usage:')
  console.error('  npx tsx scripts/reseed-client-settings.ts --slug <slug> [--live]')
  console.error('  npx tsx scripts/reseed-client-settings.ts --all-actionable [--live] [--include-hand-tuned]')
  console.error('')
  console.error('Default is DRY-RUN. Pass --live to actually fire reseed.')
}

interface ClientRow {
  id: string
  slug: string
  niche: string | null
  hand_tuned: boolean | null
  knowledge_backend: string | null
  business_facts: unknown
  extra_qa: unknown
}

interface ClientStatus {
  slug: string
  reseedState: 'never-ran' | 'partial' | 'complete' | 'no-settings-content' | 'not-pgvector'
  factCount: number
  qaCount: number
  existingSettingsEditChunks: number
  handTuned: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function inspectClient(supabase: any, slug: string): Promise<{ row: ClientRow | null; status: ClientStatus | null; error: string | null }> {
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, slug, niche, hand_tuned, knowledge_backend, business_facts, extra_qa')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return { row: null, status: null, error: error.message }
  if (!client) return { row: null, status: null, error: 'not found' }
  const row = client as ClientRow

  const businessFacts = Array.isArray(row.business_facts) ? (row.business_facts as unknown[]).filter((f): f is string => typeof f === 'string') : []
  const extraQa = Array.isArray(row.extra_qa) ? (row.extra_qa as unknown[]).filter((p): p is { q: string; a: string } => {
    return !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).q === 'string' && typeof (p as Record<string, unknown>).a === 'string'
  }) : []

  const { count: chunkCount } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', row.id)
    .eq('source', 'settings_edit')

  const hasContent = businessFacts.length > 0 || extraQa.length > 0
  let state: ClientStatus['reseedState']
  if (row.knowledge_backend !== 'pgvector') state = 'not-pgvector'
  else if (!hasContent) state = 'no-settings-content'
  else if ((chunkCount ?? 0) === 0) state = 'never-ran'
  else state = 'partial' // could be 'complete' but cheaper to assume partial and let reseed dedupe

  return {
    row,
    status: {
      slug: row.slug,
      reseedState: state,
      factCount: businessFacts.length,
      qaCount: extraQa.length,
      existingSettingsEditChunks: chunkCount ?? 0,
      handTuned: Boolean(row.hand_tuned),
    },
    error: null,
  }
}

interface ReseedAttempt {
  slug: string
  preState: ClientStatus['reseedState']
  factsPushed: number
  qaPushed: number
  stored: number | null
  failed: number | null
  skipped: boolean
  skipReason: string | null
  errorMessage: string | null
}

async function reseedOne(row: ClientRow, status: ClientStatus, live: boolean, includeHandTuned: boolean): Promise<ReseedAttempt> {
  const attempt: ReseedAttempt = {
    slug: row.slug,
    preState: status.reseedState,
    factsPushed: status.factCount,
    qaPushed: status.qaCount,
    stored: null,
    failed: null,
    skipped: false,
    skipReason: null,
    errorMessage: null,
  }

  if (status.reseedState === 'not-pgvector') {
    attempt.skipped = true
    attempt.skipReason = 'knowledge_backend != pgvector'
    return attempt
  }
  if (status.reseedState === 'no-settings-content') {
    attempt.skipped = true
    attempt.skipReason = 'no business_facts or extra_qa to reseed'
    return attempt
  }
  if (status.handTuned && !includeHandTuned) {
    attempt.skipped = true
    attempt.skipReason = 'hand_tuned=true, pass --include-hand-tuned to override'
    return attempt
  }

  if (!live) {
    attempt.skipped = true
    attempt.skipReason = 'dry-run (pass --live to fire)'
    return attempt
  }

  try {
    const facts = (row.business_facts as string[] | string | null) ?? null
    const qa = Array.isArray(row.extra_qa) ? (row.extra_qa as { q: string; a: string }[]) : []
    const result = await reseedKnowledgeFromSettings(row.id, facts, qa)
    attempt.stored = result.stored
    attempt.failed = result.failed
  } catch (err) {
    attempt.errorMessage = err instanceof Error ? err.message : String(err)
  }
  return attempt
}

async function main(): Promise<void> {
  const args = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[reseed] Missing supabase env')
    process.exit(2)
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  console.error(`[reseed] Mode: ${args.live ? 'LIVE (will write to pgvector)' : 'DRY-RUN (no writes)'}`)

  let slugs: string[]
  if (args.allActionable) {
    // Enumerate every client with ultravox_agent_id, then filter to actionable
    const { data: fleet } = await supabase
      .from('clients')
      .select('slug')
      .not('ultravox_agent_id', 'is', null)
      .order('slug', { ascending: true })
    slugs = (fleet ?? []).map((c: { slug: string }) => c.slug)
    console.error(`[reseed] Enumerating ${slugs.length} fleet clients for actionable reseed targets...`)
  } else {
    slugs = [args.slug!]
  }

  const attempts: ReseedAttempt[] = []
  for (const slug of slugs) {
    const { row, status, error } = await inspectClient(supabase, slug)
    if (error || !row || !status) {
      attempts.push({ slug, preState: 'no-settings-content', factsPushed: 0, qaPushed: 0, stored: null, failed: null, skipped: true, skipReason: `inspect failed: ${error}`, errorMessage: error })
      continue
    }

    if (args.allActionable && (status.reseedState === 'not-pgvector' || status.reseedState === 'no-settings-content')) {
      // Don't even log these in fleet mode — they're not actionable
      continue
    }

    const attempt = await reseedOne(row, status, args.live, args.includeHandTuned)
    attempts.push(attempt)

    if (!args.json) {
      const action = attempt.skipped
        ? `SKIP (${attempt.skipReason})`
        : attempt.errorMessage
          ? `ERROR (${attempt.errorMessage.slice(0, 80)})`
          : `OK stored=${attempt.stored} failed=${attempt.failed}`
      console.log(`  ${slug.padEnd(38)} state=${attempt.preState.padEnd(13)} facts=${String(attempt.factsPushed).padStart(3)} qa=${String(attempt.qaPushed).padStart(2)} → ${action}`)
    }
  }

  // Summary
  const successes = attempts.filter(a => a.stored !== null && a.stored > 0 && !a.errorMessage).length
  const failures = attempts.filter(a => a.errorMessage !== null).length
  const skipped = attempts.filter(a => a.skipped).length
  const skippedDryRun = attempts.filter(a => a.skipped && a.skipReason === 'dry-run (pass --live to fire)').length
  const skippedHandTuned = attempts.filter(a => a.skipped && a.skipReason?.includes('hand_tuned')).length

  if (args.json) {
    console.log(JSON.stringify({ mode: args.live ? 'live' : 'dry-run', attempts, summary: { successes, failures, skipped } }, null, 2))
  } else {
    console.log('')
    console.log('─'.repeat(72))
    console.log(`SUMMARY: ${attempts.length} clients · ${successes} success · ${failures} fail · ${skipped} skip`)
    if (skippedDryRun > 0) console.log(`         ${skippedDryRun} would be reseeded with --live`)
    if (skippedHandTuned > 0) console.log(`         ${skippedHandTuned} skipped because hand_tuned=true (--include-hand-tuned to override)`)
    console.log('─'.repeat(72))
  }

  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('[reseed] fatal:', e instanceof Error ? e.stack ?? e.message : String(e))
  process.exit(3)
})
