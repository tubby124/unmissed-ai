/**
 * First read-only Client Nervous System harness checks.
 *
 * Usage:
 *   npx tsx scripts/client-nervous-system-harness-check.ts --slug=hasan-sharif --dry-run
 *   npx tsx scripts/client-nervous-system-harness-check.ts --slug=hasan-sharif,windshield-hub
 *   npx tsx scripts/client-nervous-system-harness-check.ts --all-active
 *
 * The checks only read source tables and source files. When not in --dry-run,
 * findings are persisted through the existing harness_findings writer.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  checkCallTranscriptsSourceAllowed,
  checkClientEventsTableExists,
  checkClientTimelineReportSourcesAvailable,
  checkDashboardAgentTestStatusHygiene,
  checkEventRegistryCoversEmitters,
  checkHarnessFindingsFleetNullDuplicates,
  checkPerCallContextColumnsSelectedAndMapped,
  checkPromptVersionPointerMatchesActiveVersion,
  checkReportRedactionContract,
  type EventSourceText,
  type PerCallContextSourceText,
} from '../src/lib/client-nervous-system-harness.js'
import { recordFindings, type Finding } from '../src/lib/harness-writer.js'

const EMITTER_FILES = [
  'src/lib/prompt-version-utils.ts',
  'src/lib/sync-client-tools.ts',
  'src/lib/tool-invocations.ts',
]

const PER_CALL_CONTEXT_FILES = [
  'src/app/api/webhook/[slug]/inbound/route.ts',
  'src/app/api/dashboard/agent-test/route.ts',
  'src/app/api/dashboard/test-call/route.ts',
  'src/app/api/dashboard/browser-test-call/route.ts',
  'src/app/api/trial/test-call/route.ts',
]

const DASHBOARD_AGENT_TEST_FILES = [
  'src/app/api/dashboard/agent-test/route.ts',
]

function parseSlugs(argv: string[]): string[] {
  return argv
    .filter((arg) => arg.startsWith('--slug='))
    .flatMap((arg) => arg.slice('--slug='.length).split(','))
    .map((slug) => slug.trim())
    .filter(Boolean)
}

async function fetchActiveSlugs(supabase: { from(table: string): any }): Promise<string[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('slug')
    .eq('status', 'active')
    .order('slug')

  if (error) throw new Error(`Could not fetch active client slugs: ${error.message}`)

  return ((data ?? []) as Array<{ slug: string | null }>)
    .map((row) => row.slug?.trim())
    .filter((slug): slug is string => !!slug)
}

function readEmitterSources(): EventSourceText[] {
  return EMITTER_FILES.map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
  }))
}

function readPerCallContextSources(): PerCallContextSourceText[] {
  return PER_CALL_CONTEXT_FILES.map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
  }))
}

function readDashboardAgentTestSources(): EventSourceText[] {
  return DASHBOARD_AGENT_TEST_FILES.map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
  }))
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const requestedSlugs = parseSlugs(argv)
  const allActive = argv.includes('--all-active')
  const dryRun = process.argv.includes('--dry-run')
  if (requestedSlugs.length === 0 && !allActive) {
    console.error('Usage: npx tsx scripts/client-nervous-system-harness-check.ts (--slug=client-slug[,other-slug] | --all-active) [--dry-run]')
    return 2
  }
  if (requestedSlugs.length > 0 && allActive) {
    console.error('Use either --slug or --all-active, not both')
    return 2
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return 2
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const slugs = allActive ? await fetchActiveSlugs(supabase) : requestedSlugs
  if (slugs.length === 0) {
    console.error('[client-nervous-system] no client slugs to check')
    return 2
  }

  const findings: Finding[] = [
    ...await checkClientEventsTableExists(supabase),
    ...await checkClientTimelineReportSourcesAvailable(supabase, slugs),
    ...await checkPromptVersionPointerMatchesActiveVersion(supabase, slugs),
    ...await checkHarnessFindingsFleetNullDuplicates(supabase),
    ...checkEventRegistryCoversEmitters(readEmitterSources()),
    ...checkReportRedactionContract(),
    ...checkCallTranscriptsSourceAllowed({
      migrationText: readFileSync('supabase/migrations/20260429010000_create_call_transcripts.sql', 'utf8'),
      helperText: readFileSync('src/lib/call-transcripts.ts', 'utf8'),
    }),
    ...checkPerCallContextColumnsSelectedAndMapped(readPerCallContextSources()),
    ...checkDashboardAgentTestStatusHygiene(readDashboardAgentTestSources()),
  ]

  console.log(`[client-nervous-system] checked slugs=${slugs.join(', ')} findings=${findings.length}${dryRun ? ' (dry-run)' : ''}`)
  for (const finding of findings) {
    console.log(`  [${finding.severity}] ${finding.client_slug ?? 'fleet'} ${finding.check_name}: ${finding.summary}`)
  }

  if (!dryRun && findings.length > 0) {
    const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`
    const result = await recordFindings({
      harness: 'client-nervous-system',
      run_id: runId,
      findings,
    })
    console.log(`[client-nervous-system] harness_findings: wrote=${result.written} reopened=${result.reopened} errors=${result.errors.length}`)
    for (const error of result.errors) console.error(`  [recordFindings] ${error}`)
    if (result.errors.length > 0) return 2
  } else if (dryRun) {
    console.log('[client-nervous-system] dry-run: skipping harness_findings write')
  }

  return findings.length > 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[client-nervous-system] fatal:', err)
    process.exit(2)
  })
