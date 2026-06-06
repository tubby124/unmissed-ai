/**
 * Migrate Aman off the Wave 1.5 snowflake niche_custom_variables override.
 * Layer A (universal PERSONAL/OFF-TOPIC MESSAGE FLOW in prompt-slots.ts) + Layer B
 * (real_estate niche-default cleanup in niche-defaults.ts) now cover the same
 * behavior as the Wave 1.5 TRIAGE_DEEP + FORBIDDEN_EXTRA personal-calls override.
 * Keeping both produces ~25.5K chars (over the 25.3K hard cap). Drop them.
 *
 * Preserves GREETING_OVERRIDE (still niche-specific).
 *
 *   npx tsx scripts/migrate-aman-drop-snowflake.ts             # dryrun
 *   npx tsx scripts/migrate-aman-drop-snowflake.ts --live      # write DB + recompose + Ultravox PATCH
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

const SLUG = 'walia-family'
const LIVE = process.argv.includes('--live')
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  const { data: client, error } = await svc
    .from('clients')
    .select('id, slug, hand_tuned, niche_custom_variables, ultravox_agent_id, system_prompt')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (error || !client) throw new Error(`${SLUG} lookup failed: ${error?.message ?? 'not found'}`)

  const row = client as {
    id: string
    hand_tuned: boolean
    niche_custom_variables: Record<string, unknown> | null
    ultravox_agent_id: string | null
    system_prompt: string | null
  }
  if (row.hand_tuned) throw new Error('REFUSING: hand_tuned=true')
  if (!row.ultravox_agent_id) throw new Error('REFUSING: missing ultravox_agent_id')

  const current = (row.niche_custom_variables ?? {}) as Record<string, unknown>
  const stripped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(current)) {
    if (k === 'TRIAGE_DEEP') continue
    if (k === 'FORBIDDEN_EXTRA') {
      const text = String(v ?? '')
      const cleaned = text
        .split(/\r?\n/)
        .filter(line => !line.toLowerCase().includes('personal calls'))
        .join('\n')
        .trim()
      if (cleaned) stripped[k] = cleaned
      continue
    }
    stripped[k] = v
  }

  console.log(`mode = ${LIVE ? 'LIVE' : 'DRYRUN'}`)
  console.log(`ncv before: ${Object.keys(current).join(', ')}`)
  console.log(`ncv after:  ${Object.keys(stripped).join(', ')}`)
  console.log(`current prompt: ${row.system_prompt?.length ?? 0} chars`)

  if (!LIVE) {
    console.log('\n(dry run — no writes. Pass --live to apply.)')
    return
  }

  console.log('\n[1/3] writing niche_custom_variables...')
  const { error: updErr } = await svc
    .from('clients')
    .update({ niche_custom_variables: stripped })
    .eq('id', row.id)
  if (updErr) throw new Error(`DB update failed: ${updErr.message}`)
  console.log('  done.')

  console.log('\n[2/3] resolving admin user_id...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (cuErr || !adminCu?.user_id) throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)

  console.log('\n[3/3] recomposing live (Supabase + Ultravox PATCH)...')
  const result = await recomposePrompt(row.id, adminCu.user_id as string, false, true)
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) {
    console.error('recompose failed.')
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
