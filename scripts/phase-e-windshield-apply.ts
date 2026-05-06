/**
 * D445 Windshield-Hub Phase E — APPLY MIGRATION
 *
 * THIS IS THE DESTRUCTIVE STEP.
 *
 * Calls recomposePrompt(clientId, userId, dryRun=false, forceRecompose=true)
 * which:
 *   1. Generates the slot-composed prompt from current DB state
 *   2. Inserts audit row in prompt_versions (rollback artifact)
 *   3. Updates clients.active_prompt_version_id
 *   4. Overwrites clients.system_prompt (8,586 → ~14,526 chars)
 *   5. Auto-PATCHes Ultravox callTemplate.systemPrompt via savePromptAndSync
 *   6. Does NOT touch clients.tools (runtime authoritative, D442 lesson)
 *   7. Does NOT touch hand_tuned (Phase G is the +7-day flip)
 *
 * Mark's agent (Ultravox 00652ba8) starts using the new prompt on next call.
 *
 * Pre-flight: takes a fresh snapshot of pre-deploy state for rollback.
 * Post-flight: verifies all 4 truths in sync, prints rollback SQL.
 *
 * Run: npx tsx scripts/phase-e-windshield-apply.ts
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import * as fs from 'node:fs'
import * as path from 'node:path'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const SLUG = 'windshield-hub'
const SNAPSHOT_DIR = 'docs/refactor-baseline/snapshots/2026-04-30-pre-d442'
const TODAY = new Date().toISOString().slice(0, 10)

async function main() {
  console.log('═'.repeat(60))
  console.log('D445 PHASE E — APPLY MIGRATION (windshield-hub)')
  console.log('═'.repeat(60))

  // [1] Resolve client + admin user
  console.log('\n[1/6] Resolving client + admin user...')
  const { data: client, error: cErr } = await svc
    .from('clients')
    .select('id, slug, system_prompt, hand_tuned, ultravox_agent_id, ' +
      'tools, last_agent_sync_status, services_offered, fields_to_collect, ' +
      'active_prompt_version_id')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (cErr || !client) throw new Error(`client lookup failed: ${cErr?.message ?? 'not found'}`)
  const c = client as unknown as Record<string, unknown>
  console.log(`  client.id=${c.id}`)
  console.log(`  hand_tuned=${c.hand_tuned}  ultravox_agent_id=${c.ultravox_agent_id}`)
  console.log(`  current system_prompt length=${(c.system_prompt as string)?.length ?? 0}`)

  if (c.hand_tuned !== true) {
    throw new Error('hand_tuned must be true to require forceRecompose=true; aborting (unexpected state)')
  }

  const { data: adminCu, error: aErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (aErr || !adminCu?.user_id) throw new Error(`no admin user: ${aErr?.message}`)
  const userId = adminCu.user_id as string
  console.log(`  admin user_id=${userId}`)

  // [2] Take fresh pre-deploy snapshot (rollback artifact)
  console.log('\n[2/6] Taking fresh pre-deploy snapshot...')
  const snapPath = path.join(SNAPSHOT_DIR, `windshield-hub-system-prompt-pre-d445-${TODAY}.txt`)
  fs.writeFileSync(snapPath, (c.system_prompt as string) ?? '')
  console.log(`  wrote ${snapPath} (${((c.system_prompt as string) ?? '').length} chars)`)

  // Capture tools snapshot for runtime drift verification
  const toolsBefore = c.tools as unknown[] | null
  const toolsBeforeStr = JSON.stringify(toolsBefore)
  console.log(`  pre-deploy tools count: ${Array.isArray(toolsBefore) ? toolsBefore.length : 0}`)

  // [3] Apply migration
  console.log('\n[3/6] Calling recomposePrompt(dryRun=false, forceRecompose=true)...')
  console.log('       (this writes clients.system_prompt + prompt_versions + PATCHes Ultravox)')
  const result = await recomposePrompt(
    c.id as string,
    userId,
    /* dryRun */ false,
    /* forceRecompose */ true,
  )
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  error=${result.error ?? 'none'}`)
  if (!result.success) {
    console.error('\n  ❌ MIGRATION FAILED — see error above. clients.system_prompt may or may not have changed.')
    console.error('  Run [6/6] verification block manually to inspect state.')
    process.exit(1)
  }

  // [4] Verify clients.system_prompt updated
  console.log('\n[4/6] Verifying clients.system_prompt + prompt_versions...')
  const { data: post, error: pErr } = await svc
    .from('clients')
    .select('system_prompt, hand_tuned, tools, last_agent_sync_status, ' +
      'last_agent_sync_at, last_agent_sync_error, active_prompt_version_id')
    .eq('id', c.id as string)
    .limit(1)
    .maybeSingle()
  if (pErr || !post) throw new Error(`post-fetch failed: ${pErr?.message}`)
  const p = post as unknown as Record<string, unknown>
  console.log(`  post system_prompt length: ${((p.system_prompt as string) ?? '').length}`)
  console.log(`  post hand_tuned: ${p.hand_tuned} (should still be true)`)
  console.log(`  post last_agent_sync_status: ${p.last_agent_sync_status ?? '—'}`)
  console.log(`  post last_agent_sync_at: ${p.last_agent_sync_at ?? '—'}`)
  console.log(`  post last_agent_sync_error: ${p.last_agent_sync_error ?? 'none'}`)
  console.log(`  post active_prompt_version_id: ${p.active_prompt_version_id ?? '—'}`)

  // [5] Verify clients.tools UNCHANGED (D442 lesson)
  console.log('\n[5/6] Verifying clients.tools UNCHANGED (D442 lesson)...')
  const toolsAfter = p.tools as unknown[] | null
  const toolsAfterStr = JSON.stringify(toolsAfter)
  if (toolsAfterStr === toolsBeforeStr) {
    console.log(`  ✅ tools unchanged (${Array.isArray(toolsAfter) ? toolsAfter.length : 0} entries)`)
  } else {
    console.error(`  ⚠️  tools CHANGED — investigate. before=${toolsBeforeStr.length} chars, after=${toolsAfterStr.length} chars`)
  }

  // [6] Fetch the prompt_versions audit row for rollback SQL
  console.log('\n[6/6] Locating prompt_versions audit rows for rollback...')
  const { data: versions } = await svc
    .from('prompt_versions')
    .select('id, version, created_at, system_prompt_text')
    .eq('client_id', c.id as string)
    .order('version', { ascending: false })
    .limit(3)
  console.log('  recent prompt_versions:')
  for (const v of versions ?? []) {
    const vr = v as unknown as Record<string, unknown>
    const len = ((vr.system_prompt_text as string) ?? '').length
    console.log(`    v${vr.version} (${vr.created_at}) — ${len} chars  id=${vr.id}`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('✅ MIGRATION APPLIED')
  console.log('═'.repeat(60))
  console.log(`\nNext steps:`)
  console.log(`  1. Phase F — make 3+ test calls to Mark's DID (or use staged-test driver)`)
  console.log(`     Each call now uses the new slot-composed prompt.`)
  console.log(`  2. /review-call <callId> for each — confirm voice + intake match expectations`)
  console.log(`  3. If any regression → emergency rollback below.`)
  console.log(`\nROLLBACK (paste in psql / Supabase SQL editor if needed):`)
  console.log(`  -- Find the previous version (current=top, rollback target=second from top):`)
  console.log(`  -- SELECT id, version, char_length(system_prompt_text) FROM prompt_versions`)
  console.log(`  --   WHERE client_id='${c.id}' ORDER BY version DESC LIMIT 5;`)
  console.log(`  --`)
  console.log(`  -- Then revert (use the version_id ONE BELOW the current top):`)
  console.log(`  UPDATE clients`)
  console.log(`    SET system_prompt = (SELECT system_prompt_text FROM prompt_versions WHERE id = '<previous-version-id>'),`)
  console.log(`        active_prompt_version_id = '<previous-version-id>'`)
  console.log(`    WHERE id = '${c.id}';`)
  console.log(`  -- Then PATCH Ultravox to match (run via /api/admin/agent-resync or scripts/sync-ultravox.ts)`)
  console.log(`\nRollback file artifact: ${snapPath}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
