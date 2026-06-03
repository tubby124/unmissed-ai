// Surgical Bug 3 fix for Brian — regenerates ONLY the returning_caller slot.
// Leaves the other 13 slots untouched, so the prompt grows by ~47 chars (Bug 3 fix prose)
// and avoids re-pulling extra_qa / business_facts into the prompt (the slot pipeline leak).
//
// Default: dryrun (read-only). Pass --live to actually patch DB + Ultravox.
//   npx tsx scripts/regenerate-brian-returning-caller.ts          # dryrun
//   npx tsx scripts/regenerate-brian-returning-caller.ts --live   # patch DB + sync Ultravox

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import { regenerateSlot } from '../src/lib/slot-regenerator'

const SLUG = 'calgary-property-leasing'
const LIVE = process.argv.includes('--live')

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: client } = await svc.from('clients').select('id, system_prompt').eq('slug', SLUG).single()
  if (!client) throw new Error('not found')

  const { data: adminCu } = await svc.from('client_users').select('user_id').eq('role', 'admin').limit(1).maybeSingle()
  if (!adminCu?.user_id) throw new Error('no admin user_id')

  const before = (client.system_prompt as string).length
  console.log(`Brian client_id=${client.id}`)
  console.log(`current prompt: ${before} chars`)
  console.log(`mode: ${LIVE ? 'LIVE (DB write + Ultravox PATCH)' : 'DRYRUN (no writes)'}`)

  const result: any = await regenerateSlot(client.id as string, 'returning_caller' as any, adminCu.user_id as string, !LIVE)

  console.log(`\nresult.success: ${result.success}`)
  console.log(`result.promptChanged: ${result.promptChanged}`)
  console.log(`result.charCount: ${result.charCount} (delta ${result.charCount ? result.charCount - before : 'n/a'})`)
  if (result.error) console.log(`result.error: ${result.error}`)

  if (!LIVE && result.preview) {
    fs.writeFileSync('tests/promptfoo/snapshots/brian-bug3-patched-2026-06-02.txt', result.preview)
    console.log(`\nWrote tests/promptfoo/snapshots/brian-bug3-patched-2026-06-02.txt for promptfoo eval.`)
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
