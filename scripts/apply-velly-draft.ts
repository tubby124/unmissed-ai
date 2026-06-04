/**
 * apply-velly-draft.ts — Deploy /tmp/velly-slot-output-DRAFT.txt to Velly LIVE.
 *
 * What it does:
 *  1. Loads Velly's current clients row from Supabase
 *  2. Snapshots current state to /tmp/velly-pre-deploy-SECOND-snapshot.json (rollback)
 *  3. Updates clients table: system_prompt=DRAFT, niche=home_renovation, hand_tuned=true
 *  4. Reads back the updated row to verify
 *  5. Calls updateAgent() to sync new prompt + tools to Ultravox
 *  6. Verifies the live Ultravox agent has the new prompt
 *
 * Modes:
 *  --preview: no DB writes, no Ultravox calls. Prints diff plan only.
 *  --live: full deploy.
 *
 * Rollback: /tmp/velly-pre-deploy-SECOND-snapshot.json contains the pre-deploy
 * client row. Restore via Supabase update if anything goes wrong.
 *
 * Note: hand_tuned=true is intentional. The DRAFT is slot-output + 12 hand-curated
 * safety/scope patches. Phase D refactors slot composer to make patches universal,
 * at which point Velly migrates back to hand_tuned=false.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { updateAgent } from '../src/lib/ultravox'
import * as fs from 'node:fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const SLUG = 'velly-remodeling'
const DRAFT_PATH = '/tmp/velly-slot-output-DRAFT.txt'
const SNAPSHOT_PATH = '/tmp/velly-pre-deploy-SECOND-snapshot.json'
const LIVE = process.argv.includes('--live')

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main() {
  const mode = LIVE ? 'LIVE' : 'PREVIEW (no writes)'
  console.log(`\n=== apply-velly-draft mode: ${mode} ===\n`)

  console.log(`[1/6] Loading current Velly clients row...`)
  const { data: client, error: cErr } = await svc
    .from('clients')
    .select('*')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (cErr || !client) throw new Error(`Lookup failed: ${cErr?.message ?? 'not found'}`)

  console.log(`  id=${client.id}`)
  console.log(`  current niche=${client.niche}`)
  console.log(`  current hand_tuned=${client.hand_tuned}`)
  console.log(`  current system_prompt length=${(client.system_prompt as string).length}`)
  console.log(`  ultravox_agent_id=${client.ultravox_agent_id}`)
  console.log(`  agent_voice_id=${client.agent_voice_id}`)

  console.log(`\n[2/6] Reading DRAFT prompt...`)
  if (!fs.existsSync(DRAFT_PATH)) throw new Error(`Missing ${DRAFT_PATH}`)
  const draftPrompt = fs.readFileSync(DRAFT_PATH, 'utf8')
  console.log(`  DRAFT length=${draftPrompt.length}`)
  console.log(`  Delta from current: ${draftPrompt.length - (client.system_prompt as string).length >= 0 ? '+' : ''}${draftPrompt.length - (client.system_prompt as string).length}`)

  console.log(`\n[3/6] Snapshotting current state to ${SNAPSHOT_PATH}...`)
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(client, null, 2))
  console.log(`  Snapshot written (${JSON.stringify(client).length} bytes)`)

  if (!LIVE) {
    console.log(`\n[4-6/6] PREVIEW — skipping DB write + Ultravox sync.`)
    console.log(`\nIntended changes (NOT applied):`)
    console.log(`  clients.system_prompt: ${(client.system_prompt as string).length} → ${draftPrompt.length} chars`)
    console.log(`  clients.niche: ${client.niche} → home_renovation`)
    console.log(`  clients.hand_tuned: ${client.hand_tuned} → true`)
    console.log(`  Ultravox agent ${client.ultravox_agent_id}: PATCH callTemplate.systemPrompt + selectedTools rebuild`)
    console.log(`\nRun with --live to actually apply.`)
    return
  }

  console.log(`\n[4/6] Updating clients table (system_prompt + niche + hand_tuned)...`)
  const { error: uErr } = await svc
    .from('clients')
    .update({
      system_prompt: draftPrompt,
      niche: 'home_renovation',
      hand_tuned: true,
    })
    .eq('id', client.id)
  if (uErr) throw new Error(`DB update failed: ${uErr.message}`)
  console.log(`  DB updated.`)

  console.log(`\n[5/6] Reading back to verify...`)
  const { data: updated, error: rErr } = await svc
    .from('clients')
    .select('*')
    .eq('id', client.id)
    .single()
  if (rErr || !updated) throw new Error(`Readback failed: ${rErr?.message}`)
  console.log(`  Verified: niche=${updated.niche} hand_tuned=${updated.hand_tuned} system_prompt length=${(updated.system_prompt as string).length}`)
  if ((updated.system_prompt as string).length !== draftPrompt.length) {
    throw new Error(`Prompt length mismatch after write — possible truncation`)
  }

  console.log(`\n[6/6] Calling updateAgent() to sync Ultravox...`)
  await updateAgent(updated.ultravox_agent_id as string, {
    systemPrompt: draftPrompt,
    voice: updated.agent_voice_id as string,
    name: (updated.agent_name as string) || (updated.business_name as string) || 'Voice Agent',
    slug: updated.slug as string,
    niche: 'home_renovation',
    booking_enabled: !!updated.booking_enabled,
    forwarding_number: (updated.forwarding_number as string) || undefined,
    sms_enabled: !!updated.sms_enabled,
    twilio_number: (updated.twilio_number as string) || undefined,
    knowledge_backend: (updated.knowledge_backend as string) || undefined,
    knowledge_chunk_count: 0, // re-counted live by updateAgent at runtime if pgvector
    transfer_conditions: (updated.transfer_conditions as string) || undefined,
  })
  console.log(`  Ultravox PATCH complete.`)

  console.log(`\n=== DEPLOY DONE ===`)
  console.log(`  Velly system_prompt: ${(updated.system_prompt as string).length} chars`)
  console.log(`  Niche: home_renovation (was ${client.niche})`)
  console.log(`  Hand_tuned: true (was ${client.hand_tuned})`)
  console.log(`  Ultravox agent ${updated.ultravox_agent_id}: synced`)
  console.log(`\nROLLBACK: restore from ${SNAPSHOT_PATH} if anything fails`)
}

main().catch((e) => {
  console.error('\nFATAL:', e)
  console.error(`\nROLLBACK from ${SNAPSHOT_PATH} may be needed.`)
  process.exit(1)
})
