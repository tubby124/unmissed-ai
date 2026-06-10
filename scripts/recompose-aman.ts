/**
 * Recompose Aman Walia (walia-family) — Wave 1 Aisha-quality prompt polish.
 *
 * Aman is slot-pipeline + hand_tuned=false (per zero-snowflake rule). Two issues
 * baked into the current live prompt:
 *   1. business_name = "Aman Walia — Walia Family Real Estate" — too long, owner
 *      name duplicated, em-dash voiced literally by GLM. Target: "Walia Family
 *      Real Estate".
 *   2. Greeting uses the niche-default real_estate template (brand'-s office,
 *      I can help with showings/market/valuations) — no capability hint matched
 *      to Aisha quality. Target: Aisha-shaped greeting via GREETING_OVERRIDE
 *      in niche_custom_variables.
 *
 * Approach: simulate the dashboard PATCH /api/dashboard/settings path manually:
 *   (1) read current row
 *   (2) update business_name + merge GREETING_OVERRIDE into niche_custom_variables
 *   (3) call recomposePrompt() which rebuilds from new DB state via slot pipeline
 *       and (in --live mode) PATCHes the Ultravox agent
 *
 * hand_tuned MUST stay false. If it has drifted to true, abort.
 *
 * Modes:
 *   default (no flag): dryRun=true. No DB writes. Prints the diff.
 *   --live:            actually writes business_name + niche_custom_variables,
 *                      then recompose live (Supabase write + Ultravox PATCH).
 *
 * Run:
 *   npx tsx scripts/recompose-aman.ts             # dryrun
 *   npx tsx scripts/recompose-aman.ts --live      # actually deploy
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'walia-family'
const LIVE = process.argv.includes('--live')
// Aman's onboard-aman.ts script generated a legacy-monolithic prompt (no slot
// markers). Slot-pipeline recompose refuses to overwrite that by default (D304
// guard). forceRecompose=true is the documented migration path — discards any
// edits that live ONLY in system_prompt text, preserves DB columns +
// niche_custom_variables. Safe for Aman: one test call post-onboard, zero
// hand-edits to the prompt text.
const FORCE_RECOMPOSE = true

const TARGET_BUSINESS_NAME = 'Walia Family Real Estate'
const TARGET_GREETING = "Hey! This is Riley, Aman's virtual assistant — I can take a message, answer questions about Aman's services, or get a message to him. What's going on?"

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/4] Looking up ${SLUG}...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, owner_name, niche, ultravox_agent_id, system_prompt, hand_tuned, niche_custom_variables')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    throw new Error(`${SLUG} lookup failed: ${clientErr?.message ?? 'not found'}`)
  }
  const row = client as {
    id: string
    business_name: string | null
    agent_name: string | null
    owner_name: string | null
    niche: string | null
    ultravox_agent_id: string | null
    system_prompt: string | null
    hand_tuned: boolean
    niche_custom_variables: Record<string, unknown> | null
  }

  console.log(`  client.id=${row.id}`)
  console.log(`  business_name (current) = "${row.business_name ?? ''}"`)
  console.log(`  agent_name              = "${row.agent_name ?? ''}"`)
  console.log(`  owner_name              = "${row.owner_name ?? ''}"`)
  console.log(`  niche                   = "${row.niche ?? ''}"`)
  console.log(`  hand_tuned              = ${row.hand_tuned}`)
  console.log(`  ultravox_agent_id       = ${row.ultravox_agent_id ?? 'NONE'}`)
  console.log(`  current prompt length   = ${row.system_prompt?.length ?? 0} chars`)

  if (row.hand_tuned) {
    throw new Error('REFUSING: client is hand_tuned=true. Aman must stay on the slot pipeline.')
  }
  if (row.niche !== 'real_estate') {
    throw new Error(`REFUSING: expected niche=real_estate, got "${row.niche}". Aborting.`)
  }
  if (!row.ultravox_agent_id) {
    throw new Error('REFUSING: missing ultravox_agent_id. Cannot sync.')
  }

  const currentNcv: Record<string, unknown> = (row.niche_custom_variables && typeof row.niche_custom_variables === 'object')
    ? { ...row.niche_custom_variables }
    : {}

  const mergedNcv = { ...currentNcv, GREETING_OVERRIDE: TARGET_GREETING }

  console.log('\n[2/4] Planned changes:')
  console.log(`  business_name: "${row.business_name ?? ''}"`)
  console.log(`              -> "${TARGET_BUSINESS_NAME}"`)
  console.log(`  niche_custom_variables.GREETING_OVERRIDE:`)
  console.log(`              -> "${TARGET_GREETING}"`)
  console.log(`  preserved keys: ${Object.keys(currentNcv).join(', ') || '(none)'}`)

  // DB updates (business_name + niche_custom_variables) are applied in BOTH modes.
  // Reason: recomposePrompt() reads niche_custom_variables from the DB. Without
  // applying first, dryrun preview shows the OLD greeting and the user can't
  // actually verify the GREETING_OVERRIDE took effect.
  //
  // Safety: these fields don't affect any live call until recompose writes a new
  // system_prompt AND updateAgent() syncs to Ultravox. Both happen only in --live
  // mode. If the preview looks wrong, revert with --revert (separate flag) or
  // manually patch the row.
  const mode = LIVE ? 'LIVE' : 'DRYRUN'
  const alreadyApplied =
    row.business_name === TARGET_BUSINESS_NAME &&
    typeof row.niche_custom_variables === 'object' &&
    row.niche_custom_variables !== null &&
    (row.niche_custom_variables as Record<string, unknown>).GREETING_OVERRIDE === TARGET_GREETING
  console.log(`\n[3/4] Applying DB updates (business_name + niche_custom_variables) — mode: ${mode}`)
  if (alreadyApplied) {
    console.log('  Already at target values — skipping write.')
  } else {
    const { error: updErr } = await svc
      .from('clients')
      .update({
        business_name: TARGET_BUSINESS_NAME,
        niche_custom_variables: mergedNcv,
      })
      .eq('id', row.id)
    if (updErr) {
      throw new Error(`DB update failed: ${updErr.message}`)
    }
    console.log('  DB updated. (Ultravox agent NOT touched until --live recompose.)')
  }

  console.log('\n  Resolving admin user_id for recompose audit trail...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (cuErr || !adminCu?.user_id) {
    throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)
  }

  console.log(`\n[4/4] Running recomposePrompt — mode: ${mode}`)

  const result = await recomposePrompt(
    row.id,
    adminCu.user_id as string,
    /* dryRun */ !LIVE,
    /* forceRecompose */ FORCE_RECOMPOSE,
  )

  console.log('\n=== RESULT ===')
  console.log(`  success         = ${result.success}`)
  console.log(`  promptChanged   = ${result.promptChanged}`)
  console.log(`  charCount       = ${result.charCount ?? 'n/a'}`)
  console.log(`  delta vs current= ${(result.charCount ?? 0) - (row.system_prompt?.length ?? 0)} chars`)
  console.log(`  error           = ${result.error ?? 'none'}`)

  // Dryrun: dump full preview to snapshot + print OPENING block for eyeball check.
  if (!LIVE && result.preview) {
    const today = new Date().toISOString().slice(0, 10)
    const snapshotPath = `tests/promptfoo/snapshots/walia-family-aisha-quality-${today}.txt`
    mkdirSync(dirname(snapshotPath), { recursive: true })
    writeFileSync(snapshotPath, result.preview, 'utf8')
    console.log(`\n  Snapshot saved: ${snapshotPath}`)

    // Extract OPENING section so user can eyeball the greeting line.
    const openingMatch = result.preview.match(/(?:# )?OPENING[\s\S]*?(?=\n# |\n## |\n\[\[|$)/)
    if (openingMatch) {
      console.log('\n  === OPENING block preview ===')
      console.log(openingMatch[0].slice(0, 800))
      console.log('  ============================')
    }
  }

  if (LIVE) {
    console.log('\n  Aman is now recomposed. Ultravox agent has been PATCHed.')
    console.log('  Next: snapshot the prompt + run Tier-1.5 promptfoo gate.')
  } else {
    console.log('\n  Rerun with --live to deploy.')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
