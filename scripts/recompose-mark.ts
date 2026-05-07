/**
 * Recompose Mark (windshield-hub) — pick up PR #92 (cross-niche slot:
 * ANSWER-FIRST + TOOL-LATENCY BRIDGE as universal rules 9 & 10) and
 * PR #94 (acknowledgment rotation pool of 9, max 2 uses per call).
 *
 * Mark is slot-pipeline + hand_tuned=false (per D445 migration 2026-05-06).
 * forceRecompose=false because slot generator code on main now produces the
 * new universal rules; recomposing re-renders his prompt from current DB
 * state + new slot code, then pushes to Ultravox via updateAgent().
 *
 * Modes:
 *   default (no flag): dryRun=true. Read-only.
 *   --live:            dryRun=false. Writes Supabase + PATCHes Ultravox.
 *
 * Run:
 *   npx tsx scripts/recompose-mark.ts             # dryrun
 *   npx tsx scripts/recompose-mark.ts --live      # actually deploy
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'windshield-hub'
const LIVE = process.argv.includes('--live')

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/3] Looking up ${SLUG}...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, ultravox_agent_id, system_prompt, hand_tuned')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    throw new Error(`${SLUG} lookup failed: ${clientErr?.message ?? 'not found'}`)
  }
  const row = client as { id: string; business_name: string; agent_name: string; ultravox_agent_id: string | null; system_prompt: string | null; hand_tuned: boolean }
  console.log(`  client.id=${row.id}`)
  console.log(`  business=${row.business_name}`)
  console.log(`  agent_name=${row.agent_name}`)
  console.log(`  ultravox_agent_id=${row.ultravox_agent_id ?? 'NONE'}`)
  console.log(`  hand_tuned=${row.hand_tuned}`)
  console.log(`  current system_prompt: ${row.system_prompt?.length ?? 0} chars`)

  if (row.hand_tuned) {
    throw new Error('REFUSING: client is hand_tuned=true. Recompose would overwrite the hand-written prompt.')
  }

  console.log('\n[2/3] Resolving admin user_id...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (cuErr || !adminCu?.user_id) {
    throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)
  }

  const mode = LIVE ? 'LIVE' : 'DRYRUN'
  console.log(`\n[3/3] Running recomposePrompt — mode: ${mode}`)

  const result = await recomposePrompt(
    row.id,
    adminCu.user_id as string,
    /* dryRun */ !LIVE,
    /* forceRecompose */ false,
  )

  console.log('\n=== RESULT ===')
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  delta=${(result.charCount ?? 0) - (row.system_prompt?.length ?? 0)} chars`)
  console.log(`  error=${result.error ?? 'none'}`)

  if (LIVE) {
    console.log('\n  Mark is now recomposed. Ultravox agent has been PATCHed.')
  } else {
    console.log('\n  Rerun with --live to deploy.')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
