/**
 * S13-REC2 — Backfill: convert legacy `call_logs.recording_url` rows that
 * store a full Supabase public URL to just the storage path.
 *
 *   "https://xxx.supabase.co/storage/v1/object/public/recordings/vm-RE.mp3"
 *     → "vm-RE.mp3"
 *
 * Why:
 * - Runtime already tolerates both via `extractStoragePath()` in
 *   `src/lib/recording-url.ts`. This script is housekeeping so the column
 *   has a single consistent shape going forward.
 * - Once backfilled, future tooling can assume `recording_url` is a path.
 *
 * Usage:
 *   npx tsx scripts/backfill-recording-url-paths.ts             # dry-run
 *   npx tsx scripts/backfill-recording-url-paths.ts --apply     # commit
 *
 * Writes a report to /tmp/backfill-recording-url-paths-<ts>.md.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')

interface Row {
  id: string
  client_id: string | null
  recording_url: string
  call_status: string | null
  started_at: string | null
}

/** Mirrors extractStoragePath in src/lib/recording-url.ts. */
function extractPath(value: string): string | null {
  if (!value.startsWith('http')) return value
  const m = value.match(/\/recordings\/(.+)$/)
  return m ? m[1] : null
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }

  const supa = createClient(url, key, { auth: { persistSession: false } })

  console.log(`[backfill-recording-url-paths] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  // Page through in batches of 1000 to avoid Postgres response limits on large tables.
  const PAGE_SIZE = 1000
  let from = 0
  const rows: Row[] = []
  while (true) {
    const { data, error } = await supa
      .from('call_logs')
      .select('id, client_id, recording_url, call_status, started_at')
      .like('recording_url', 'https://%')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('[backfill-recording-url-paths] page fetch failed:', error.message)
      process.exit(2)
    }
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  console.log(`[backfill-recording-url-paths] Found ${rows.length} legacy row(s)`)

  const reportLines: string[] = [
    `# Backfill recording_url paths — ${new Date().toISOString()}`,
    `Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`,
    `Legacy rows found: ${rows.length}`,
    '',
    `| id | client_id | call_status | started_at | old → new |`,
    `|---|---|---|---|---|`,
  ]

  let converted = 0
  let unparseable = 0
  let errored = 0

  for (const row of rows) {
    const newPath = extractPath(row.recording_url)
    if (!newPath || newPath === row.recording_url) {
      unparseable++
      reportLines.push(`| ${row.id} | ${row.client_id ?? '?'} | ${row.call_status ?? '?'} | ${row.started_at ?? '?'} | UNPARSEABLE: \`${row.recording_url}\` |`)
      continue
    }
    reportLines.push(`| ${row.id} | ${row.client_id ?? '?'} | ${row.call_status ?? '?'} | ${row.started_at ?? '?'} | \`${row.recording_url}\` → \`${newPath}\` |`)
    if (!APPLY) {
      converted++
      continue
    }
    const { error: upErr } = await supa
      .from('call_logs')
      .update({ recording_url: newPath })
      .eq('id', row.id)
    if (upErr) {
      errored++
      console.error(`  ✗ update failed for id=${row.id}: ${upErr.message}`)
      continue
    }
    converted++
  }

  reportLines.push('')
  reportLines.push(`Converted: ${converted} | Unparseable: ${unparseable} | Errored: ${errored}`)
  const reportPath = `/tmp/backfill-recording-url-paths-${Date.now()}.md`
  writeFileSync(reportPath, reportLines.join('\n'))
  console.log('')
  console.log(`[backfill-recording-url-paths] ${APPLY ? 'CONVERTED' : 'WOULD CONVERT'}=${converted} unparseable=${unparseable} errored=${errored}`)
  console.log(`[backfill-recording-url-paths] Report: ${reportPath}`)
  if (!APPLY && converted > 0) {
    console.log(`[backfill-recording-url-paths] Re-run with --apply to commit.`)
  }
}

main().catch((e) => {
  console.error('[backfill-recording-url-paths] FATAL:', e)
  process.exit(1)
})
