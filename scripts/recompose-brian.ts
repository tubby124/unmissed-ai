/**
 * Recompose Brian (calgary-property-leasing) — pick up PR #70 returning-caller
 * self-identity fix on his deployed Ultravox agent.
 *
 * Brian is slot-pipeline (NOT a snowflake), so forceRecompose=false. The slot
 * generator code on main now produces the new greeting language; recomposing
 * re-renders his prompt from current DB state + new slot code, then pushes to
 * Ultravox via updateAgent().
 *
 * Modes:
 *   default (no flag): dryRun=true. Read-only. Prints diff + writes JSON snapshot.
 *   --live:            dryRun=false. Writes Supabase + PATCHes Ultravox. Irreversible.
 *
 * Run:
 *   cd ~/Downloads/CALLING\ AGENTs
 *   npx tsx scripts/recompose-brian.ts             # dryrun preview
 *   npx tsx scripts/recompose-brian.ts --live      # actually deploy
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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'calgary-property-leasing'
const LIVE = process.argv.includes('--live')
const OUT_DIR = path.resolve('CALLINGAGENTS/00-Inbox')

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function diffSection(label: string, oldText: string, newText: string): void {
  if (oldText === newText) return
  console.log(`\n--- ${label} ---`)
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const max = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < max; i++) {
    const o = oldLines[i] ?? ''
    const n = newLines[i] ?? ''
    if (o !== n) {
      if (o) console.log(`  - ${o}`)
      if (n) console.log(`  + ${n}`)
    }
  }
}

function extractSection(prompt: string, header: string): string {
  const idx = prompt.indexOf(header)
  if (idx < 0) return ''
  const after = prompt.slice(idx)
  const next = after.search(/\n# [A-Z][A-Z _-]+\n/)
  return next > 0 ? after.slice(0, next).trim() : after.trim()
}

async function main(): Promise<void> {
  console.log(`[1/4] Looking up ${SLUG} client row...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, ultravox_agent_id, system_prompt')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    throw new Error(`${SLUG} lookup failed: ${clientErr?.message ?? 'not found'}`)
  }
  const clientRow = client as { id: string; business_name: string; agent_name: string; ultravox_agent_id: string | null; system_prompt: string | null }
  console.log(`  client.id=${clientRow.id}`)
  console.log(`  business=${clientRow.business_name}`)
  console.log(`  agent_name=${clientRow.agent_name}`)
  console.log(`  ultravox_agent_id=${clientRow.ultravox_agent_id ?? 'NONE'}`)
  console.log(`  current system_prompt: ${clientRow.system_prompt?.length ?? 0} chars`)

  console.log('\n[2/4] Resolving an admin user_id (for prompt_versions audit row)...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (cuErr || !adminCu?.user_id) {
    throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty result'}`)
  }
  console.log(`  admin user_id=${adminCu.user_id}`)

  const mode = LIVE ? 'LIVE (will write DB + PATCH Ultravox)' : 'DRYRUN (read-only)'
  console.log(`\n[3/4] Running recomposePrompt — mode: ${mode}`)
  console.log('  args: clientId, userId, dryRun=' + (LIVE ? 'false' : 'true') + ', forceRecompose=false')

  const result = await recomposePrompt(
    clientRow.id,
    adminCu.user_id as string,
    /* dryRun */ !LIVE,
    /* forceRecompose */ false,
  )

  console.log('\n=== RESULT ===')
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  error=${result.error ?? 'none'}`)

  if (!LIVE) {
    const oldPrompt = clientRow.system_prompt ?? ''
    const newPrompt = (result as { preview?: string }).preview ?? ''

    if (oldPrompt && newPrompt) {
      const oldSection = extractSection(oldPrompt, '# RETURNING CALLER HANDLING')
      const newSection = extractSection(newPrompt, '# RETURNING CALLER HANDLING')
      console.log('\n=== RETURNING_CALLER SECTION DIFF ===')
      diffSection('returning_caller', oldSection, newSection)
      if (oldSection === newSection) {
        console.log('  (no change in this section)')
      }
    }

    const dryrunPath = path.join(OUT_DIR, 'recompose-brian-dryrun.json')
    fs.writeFileSync(dryrunPath, JSON.stringify({ ...result, _clientRow: clientRow }, null, 2))
    console.log(`\n  wrote ${dryrunPath}`)
    console.log('\n  Next step: rerun with --live to actually deploy.')
  } else {
    console.log('\n  Brian is now recomposed. Ultravox agent has been PATCHed.')
    console.log('  Verify: hit /dashboard/calls on Brian and trigger a returning-caller test.')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
