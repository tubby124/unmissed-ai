/**
 * D445 Windshield-Hub Phase B — Backfill missing slot-pipeline fields.
 *
 * SAFE: writes only to clients.services_offered + clients.fields_to_collect.
 * Does NOT touch system_prompt, hand_tuned, ultravox_agent_id, tools.
 * Does NOT call updateAgent or syncClientTools — pure DB write.
 *
 * After this runs, re-run scripts/dryrun-windshield-hub.ts to confirm
 * slot-composed prompt picks up the populated fields.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const SLUG = 'windshield-hub'

const SERVICES_OFFERED =
  'windshield replacement, chip and crack repair, ADAS calibration, ' +
  'side glass replacement, rear glass replacement, quarter glass replacement, ' +
  'vent glass replacement, sunroof and moonroof glass, custom glass and mirrors, ' +
  'mobile windshield service, RV and heavy vehicle glass, Aquapel glass treatment, ' +
  'auto detailing, SGI insurance claim assistance'

const FIELDS_TO_COLLECT = [
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'damage_description',
  'preferred_timing',
]

async function main() {
  console.log(`[1/3] Fetching ${SLUG} pre-state for backup...`)
  const { data: pre, error: preErr } = await svc
    .from('clients')
    .select('id, slug, services_offered, fields_to_collect, system_prompt, hand_tuned')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (preErr || !pre) throw new Error(`fetch failed: ${preErr?.message ?? 'not found'}`)
  console.log(`  client.id=${(pre as any).id}`)
  console.log(`  pre services_offered=${JSON.stringify((pre as any).services_offered)}`)
  console.log(`  pre fields_to_collect=${JSON.stringify((pre as any).fields_to_collect)}`)
  console.log(`  pre hand_tuned=${(pre as any).hand_tuned}`)
  console.log(`  pre system_prompt length=${((pre as any).system_prompt as string)?.length ?? 0}`)

  // Backup the pre-state to disk
  const backupPath = `CALLINGAGENTS/00-Inbox/windshield-hub-phase-b-pre-backup.json`
  fs.writeFileSync(backupPath, JSON.stringify(pre, null, 2))
  console.log(`  wrote backup to ${backupPath}`)

  console.log(`[2/3] Updating services_offered + fields_to_collect...`)
  const { data: post, error: updErr } = await svc
    .from('clients')
    .update({
      services_offered: SERVICES_OFFERED,
      fields_to_collect: FIELDS_TO_COLLECT,
    })
    .eq('slug', SLUG)
    .select('services_offered, fields_to_collect, hand_tuned, system_prompt')
    .limit(1)
    .maybeSingle()
  if (updErr || !post) throw new Error(`update failed: ${updErr?.message ?? 'no row'}`)

  console.log(`[3/3] Verification — post-state:`)
  console.log(`  services_offered (${(post as any).services_offered?.length ?? 0} chars): "${((post as any).services_offered as string)?.slice(0, 100)}..."`)
  console.log(`  fields_to_collect: ${JSON.stringify((post as any).fields_to_collect)}`)
  console.log(`  hand_tuned (untouched): ${(post as any).hand_tuned}`)
  console.log(`  system_prompt length (untouched): ${((post as any).system_prompt as string)?.length ?? 0}`)
  console.log(`\nDone. Re-run scripts/dryrun-windshield-hub.ts to verify slot pipeline picks up new fields.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
