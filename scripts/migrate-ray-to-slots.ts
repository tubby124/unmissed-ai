/**
 * D445 migration: unlock Ray / Urban Vibe Properties — flip hand_tuned=false
 * + forceRecompose so slot pipeline rebuilds with all today's universal rules
 * + future dashboard edits work.
 *
 * Ray's situation differs from Velly's:
 *  - niche=property-management already maps to NICHE_DEFAULTS.property_management
 *    via resolveProductionNiche() (hyphen → underscore normalization)
 *  - niche_custom_variables already populated (CLOSE_PERSON, GREETING_OVERRIDE,
 *    FORBIDDEN_EXTRA — the bespoke "no gotcha", "virtual assistant not AI",
 *    gas-smell-Atco handling)
 *  - business_facts + extra_qa already populated (small but present)
 *  - All other slot fields are NULL and will be filled by PM niche defaults
 *
 * So the migration is essentially: flip hand_tuned + recompose. PM defaults
 * fill everything that isn't custom.
 *
 * Modes:
 *   default (no flag): dryRun=true. Hand_tuned flip happens in DB but recompose is read-only.
 *   --live:            Same flip + recompose actually writes new prompt + PATCHes Ultravox.
 *
 * Rollback: snapshot at /tmp/ray-pre-migration-snapshot.json.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import * as fs from 'node:fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const SLUG = 'urban-vibe'
const LIVE = process.argv.includes('--live')
const SNAPSHOT_PATH = '/tmp/ray-pre-migration-snapshot.json'

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/4] Snapshot ${SLUG}...`)
  const { data: before, error: cErr } = await svc
    .from('clients')
    .select('id, slug, niche, hand_tuned, system_prompt, custom_niche_config, niche_custom_variables, ultravox_agent_id')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (cErr || !before) throw new Error(`Lookup failed: ${cErr?.message}`)

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(before, null, 2))
  console.log(`  snapshot: ${SNAPSHOT_PATH} (${(before.system_prompt as string).length} char hand-tuned prompt preserved)`)

  console.log('\n[2/4] Resolving admin user_id...')
  const { data: admin, error: aErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (aErr || !admin?.user_id) throw new Error(`No admin: ${aErr?.message}`)
  const userId = admin.user_id as string

  console.log('\n[3/4] Flipping hand_tuned=false...')
  const { error: uErr } = await svc
    .from('clients')
    .update({ hand_tuned: false })
    .eq('id', before.id as string)
  if (uErr) throw new Error(`Flip failed: ${uErr.message}`)
  console.log('  hand_tuned now false.')

  const mode = LIVE ? 'LIVE' : 'DRYRUN'
  console.log(`\n[4/4] Running recomposePrompt — mode: ${mode}, forceRecompose=true`)
  const result = await recomposePrompt(
    before.id as string,
    userId,
    /* dryRun */ !LIVE,
    /* forceRecompose */ true,
  )

  console.log('\n=== RESULT ===')
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  delta=${(result.charCount ?? 0) - (before.system_prompt as string).length} chars`)
  console.log(`  error=${result.error ?? 'none'}`)

  const preview = (result as { preview?: string }).preview
  if (preview) {
    fs.writeFileSync('/tmp/ray-slot-output.txt', preview)
    console.log(`  slot output written to /tmp/ray-slot-output.txt (${preview.length} chars)`)
  }

  if (LIVE) {
    console.log('\n  Ray is now slot-pipeline. Ultravox PATCHed. Dashboard edits will flow.')
  } else {
    console.log('\n  DRYRUN done. Inspect /tmp/ray-slot-output.txt before --live.')
  }
}

main().catch((e) => {
  console.error('FATAL:', e)
  console.error('\nROLLBACK from /tmp/ray-pre-migration-snapshot.json may be needed.')
  process.exit(1)
})
