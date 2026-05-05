/**
 * D445 Phase D — Urban Vibe live deploy.
 *
 * IRREVERSIBLE. Pushes the slot-pipeline-recomposed prompt to clients.system_prompt
 * AND syncs to the live Ultravox agent. Takes a rollback snapshot first.
 *
 * Pre-conditions (do NOT run otherwise):
 *   1. PR #69 (B.0 code prereqs) merged to main ✅ (2026-05-05)
 *   2. scripts/d445-urban-vibe-phase-a.sql applied via Supabase Management API
 *   3. scripts/dryrun-urban-vibe.ts re-run AFTER Phase A — confirms preview matches
 *      release-gate checklist (greeting / Atco / Ray name / hours / no gotcha / etc.)
 *   4. System smoke (5+ test calls Brian + Hasan + ≥1 other live client) clean
 *   5. Hasan explicitly says "execute urban vibe deploy"
 *
 * Run: npx tsx scripts/deploy-urban-vibe.ts
 *
 * Rollback path: scripts/rollback-urban-vibe.ts reads the snapshot this writes.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main() {
  console.log('[1/4] Resolving urban-vibe client + admin user…')
  const { data: clientRaw, error: clientErr } = await svc
    .from('clients')
    .select('id, system_prompt, business_name')
    .eq('slug', 'urban-vibe')
    .limit(1)
    .maybeSingle()
  if (clientErr || !clientRaw) throw new Error(`urban-vibe lookup failed: ${clientErr?.message ?? 'not found'}`)
  const client = clientRaw as unknown as { id: string; system_prompt: string | null; business_name: string | null }

  const { data: adminRaw, error: adminErr } = await svc
    .from('client_users')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (adminErr || !adminRaw) throw new Error(`admin lookup failed: ${adminErr?.message ?? 'not found'}`)
  const admin = adminRaw as unknown as { user_id: string }

  console.log(`  client.id=${client.id} business_name="${client.business_name}"`)
  console.log(`  current system_prompt = ${client.system_prompt?.length ?? 0} chars`)

  console.log('[2/4] Writing rollback snapshot…')
  const stamp = new Date().toISOString().slice(0, 10)
  const snapshotDir = path.resolve(`docs/refactor-baseline/snapshots/${stamp}-pre-d445-deploy`)
  fs.mkdirSync(snapshotDir, { recursive: true })
  const snapshotPath = path.join(snapshotDir, 'urban-vibe-system-prompt.txt')
  fs.writeFileSync(snapshotPath, client.system_prompt ?? '')
  console.log(`  rollback snapshot saved: ${snapshotPath}`)

  console.log('[3/4] Running recomposePrompt(dryRun=false, forceRecompose=true)…')
  const result = await recomposePrompt(
    client.id,
    admin.user_id,
    /* dryRun */ false,
    /* forceRecompose */ true,
  )
  console.log('  result:', JSON.stringify(result, null, 2))
  if (!result.success) throw new Error(`recompose failed: ${result.error}`)

  console.log('[4/4] DONE.')
  console.log('  promptChanged:', result.promptChanged)
  console.log('  new charCount:', result.charCount)
  console.log('')
  console.log('Next steps (manual):')
  console.log('  - Run Phase E test calls (5+ scenarios) against +14036057142')
  console.log('  - Run /review-call <id> after each')
  console.log('  - If any fails: scripts/rollback-urban-vibe.ts')
  console.log('  - If all pass: Phase G hygiene (memory + vault + Telegram to Ray)')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
