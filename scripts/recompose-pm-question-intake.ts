/**
 * Recompose PM clients with QUESTION_INTAKE branch + ANSWER-FIRST + TOOL-LATENCY BRIDGE.
 *
 * Two clients in scope:
 *   - calgary-property-leasing (Brian, hand_tuned=false)
 *   - urban-vibe (Ray, hand_tuned=true → needs forceRecompose=true)
 *
 * Both pull from the property_management niche-defaults that just got the QUESTION_INTAKE
 * top-level branch + 2 universal FORBIDDEN_EXTRA rules + TRIAGE_SCRIPT line 641 swap.
 *
 * Modes:
 *   default (no flag): dryRun=true. Read-only. Prints summary.
 *   --live:            dryRun=false. Writes Supabase + PATCHes Ultravox per client.
 *
 * Run:
 *   npx tsx scripts/recompose-pm-question-intake.ts          # dryrun preview
 *   npx tsx scripts/recompose-pm-question-intake.ts --live   # actually deploy both
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const LIVE = process.argv.includes('--live')
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const TARGETS = [
  { slug: 'calgary-property-leasing', label: 'Brian (hand_tuned=false)' },
  { slug: 'urban-vibe',               label: 'Ray (hand_tuned=true → forceRecompose=true)' },
]

async function recomposeOne(slug: string, adminUserId: string): Promise<void> {
  const { data: client, error } = await svc.from('clients')
    .select('id, slug, business_name, hand_tuned, ultravox_agent_id, system_prompt')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()
  if (error || !client) throw new Error(`${slug} lookup failed: ${error?.message ?? 'not found'}`)
  const row = client as {
    id: string; slug: string; business_name: string;
    hand_tuned: boolean | null; ultravox_agent_id: string | null;
    system_prompt: string | null
  }

  console.log(`\n→ ${slug} (${row.business_name})`)
  console.log(`  client_id=${row.id}  agent_id=${row.ultravox_agent_id ?? 'NONE'}`)
  console.log(`  hand_tuned=${row.hand_tuned}  current_chars=${row.system_prompt?.length ?? 0}`)

  const result = await recomposePrompt(
    row.id,
    adminUserId,
    /* dryRun */ !LIVE,
    /* forceRecompose */ true,
  )

  console.log(`  success=${result.success}  promptChanged=${result.promptChanged}  charCount=${result.charCount ?? 'n/a'}`)
  if (result.error) console.log(`  ERROR: ${result.error}`)

  if (LIVE && result.success) {
    const preview = (result as { preview?: string }).preview ?? ''
    const hasIntake = preview.includes('QUESTION INTAKE')
    const hasAnswerFirst = preview.includes('ANSWER-FIRST RULE')
    const hasBridge = preview.includes('TOOL-LATENCY BRIDGE')
    console.log(`  postdeploy: QUESTION_INTAKE=${hasIntake} ANSWER_FIRST=${hasAnswerFirst} BRIDGE=${hasBridge}`)
  }
}

async function main(): Promise<void> {
  console.log('[1/3] Resolving admin user_id...')
  const { data: adminCu, error: cuErr } = await svc.from('client_users')
    .select('user_id, role').eq('role', 'admin').limit(1).maybeSingle()
  if (cuErr || !adminCu?.user_id) throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)
  const adminUserId = adminCu.user_id as string
  console.log(`  admin user_id=${adminUserId}`)

  const mode = LIVE ? 'LIVE (will write DB + PATCH Ultravox)' : 'DRYRUN (read-only)'
  console.log(`\n[2/3] Mode: ${mode}`)
  console.log('  args: dryRun=' + (LIVE ? 'false' : 'true') + ', forceRecompose=true (both)')

  for (const t of TARGETS) {
    try {
      await recomposeOne(t.slug, adminUserId)
    } catch (e) {
      console.error(`  ERR on ${t.slug}: ${(e as Error).message}`)
    }
  }

  console.log('\n[3/3] Done.')
  if (!LIVE) console.log('  Rerun with --live to actually deploy.')
  else console.log('  Both PM clients recomposed. Verify with phone test calls.')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
