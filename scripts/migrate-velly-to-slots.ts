/**
 * D445-style migration: convert Velly Remodeling from hand_tuned snowflake
 * to slot pipeline so dashboard edits work + future universal rules auto-flow.
 *
 * Steps:
 *  1. Snapshot current state (prompt, hand_tuned, custom_niche_config, niche_custom_variables)
 *  2. Populate custom_niche_config + niche_custom_variables from hand-tuned content
 *  3. Set hand_tuned=false
 *  4. Run recomposePrompt with forceRecompose=true
 *  5. (dryrun) Show diff + write snapshot. (live) Push to Ultravox.
 *
 * Modes:
 *   default (no flag): dryRun=true. Writes config to DB but recompose is read-only.
 *                      WARNING: this DOES update custom_niche_config + niche_custom_variables
 *                      + hand_tuned in the DB even in dryrun mode (slot pipeline needs them
 *                      to read). The recompose itself is read-only. Snapshot saves rollback data.
 *   --live:            Same DB updates + recompose actually writes new prompt + PATCHes Ultravox.
 *
 * Rollback: snapshot at /tmp/velly-pre-migration-snapshot.json contains everything to revert.
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

const SLUG = 'velly-remodeling'
const LIVE = process.argv.includes('--live')
const SNAPSHOT_PATH = '/tmp/velly-pre-migration-snapshot.json'

// Built from Eric's hand-tuned prompt content. Each field cross-referenced to source.
const CUSTOM_NICHE_CONFIG = {
  industry: 'renovation and construction',
  primary_call_reason: 'renovation quote inquiry or project intake',
  triage_deep: 'HOT = caller has an active jobsite issue, deposit-related question, or is ready to proceed with a renovation now. WARM = interested in a quote, wants a callback, no urgency. COLD = info-only inquiry, comparing options, no clear timeline. JUNK = spam, sales pitch to Velly, robocall, wrong number.',
  info_to_collect: 'project type, property address or neighbourhood, scope summary, timeline, budget range (if offered), caller name, callback number',
  faq_defaults: [
    'Do you do basement suites? — Yes, including legal secondary suites and rental development units.',
    'What is your service area? — Saskatoon and surrounding area.',
    'Can I get a quote over the phone? — The team likes to look at the project before quoting so they get it right. I can grab the details and have someone call you back within a business day.',
    'How much does a typical kitchen remodel cost? — Ranges depend a lot on scope and finishes. The team will put together a personalized number once they see what you are working with.',
    'Do you do commercial work? — We focus on residential — renovations, new builds, basement suites, kitchens, bathrooms. We do not do commercial fit-outs.',
  ],
  classification_rule: 'HOT = active jobsite issue or deposit-related, WARM = quote request with callback, COLD = info-only, JUNK = spam or wrong number.',
  close_person: 'the team',
  close_action: 'call you back within a business day',
}

// Niche_custom_variables for slot-level overrides (greeting line, hard rules quirks, etc.)
const NICHE_CUSTOM_VARIABLES = {
  GREETING_LINE: 'Thanks for calling Velly Remodeling, this is Eric. We do renovations, new builds, basement suites, kitchens and bathrooms — what are you looking to get done?',
  PRIMARY_GOAL: 'Take a clean intake on every renovation lead and decide who needs to talk to the owner versus who you can capture as a normal lead. Never quote firm prices or promise timelines on the phone — the team gives personalized estimates after reviewing the project.',
  CLOSE_ACTION: 'call you back within a business day to discuss your project',
  // Bespoke FORBIDDEN extension preserves the "never name Kausar unprompted" rule + other hard rules
  FORBIDDEN_EXTRA: [
    'Never name the owner (Kausar) to a caller unprompted. Refer to who calls them back as "someone from our team", "the team", or "the owner". If the caller says "Kausar" first, you can mirror their language naturally.',
    'Never quote firm prices, fees, square-foot rates, or hourly labour costs. Always: "someone from our team will give you a personalized estimate after they reviewed the project — that\'s how we keep quotes accurate."',
    'Never promise a start date or timeline. Always: "the team will look at the project details and come back to you with a realistic timeline."',
    'Never claim Velly does anything outside renovation/construction. If asked about real estate sales, financing, design-only work, demolition-only, or commercial fit-outs — be honest about scope.',
  ].join('\n'),
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/5] Snapshot current state for ${SLUG}...`)
  const { data: clientBefore, error: cErr } = await svc
    .from('clients')
    .select('id, slug, niche, hand_tuned, system_prompt, custom_niche_config, niche_custom_variables, ultravox_agent_id, voice_style_preset, business_facts, extra_qa, services_offered')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (cErr || !clientBefore) throw new Error(`Lookup failed: ${cErr?.message}`)

  const before = clientBefore as Record<string, unknown>
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(before, null, 2))
  console.log(`  snapshot saved to ${SNAPSHOT_PATH} (${(before.system_prompt as string).length} char hand-tuned prompt preserved for rollback)`)

  console.log('\n[2/5] Resolving admin user_id...')
  const { data: admin, error: aErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (aErr || !admin?.user_id) throw new Error(`No admin: ${aErr?.message}`)
  const userId = admin.user_id as string

  console.log('\n[3/5] Writing custom_niche_config + niche_custom_variables + hand_tuned=false...')
  const { error: uErr } = await svc
    .from('clients')
    .update({
      custom_niche_config: CUSTOM_NICHE_CONFIG,
      niche_custom_variables: NICHE_CUSTOM_VARIABLES,
      hand_tuned: false,
    })
    .eq('id', before.id as string)
  if (uErr) throw new Error(`DB update failed: ${uErr.message}`)
  console.log('  DB updated.')

  const mode = LIVE ? 'LIVE' : 'DRYRUN (recompose read-only)'
  console.log(`\n[4/5] Running recomposePrompt — mode: ${mode}, forceRecompose=true`)
  const result = await recomposePrompt(
    before.id as string,
    userId,
    /* dryRun */ !LIVE,
    /* forceRecompose */ true,
  )

  console.log('\n=== RECOMPOSE RESULT ===')
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  delta=${(result.charCount ?? 0) - (before.system_prompt as string).length} chars`)
  console.log(`  error=${result.error ?? 'none'}`)

  console.log('\n[5/5] Writing slot output preview...')
  const preview = (result as { preview?: string }).preview
  if (preview) {
    fs.writeFileSync('/tmp/velly-slot-output.txt', preview)
    console.log(`  slot output written to /tmp/velly-slot-output.txt (${preview.length} chars)`)
  }

  if (LIVE) {
    console.log('\n  Velly is now slot-pipeline. Ultravox PATCHed. Dashboard edits will now flow.')
  } else {
    console.log('\n  DRYRUN done. DB has new config but prompt + Ultravox unchanged.')
    console.log('  Inspect /tmp/velly-slot-output.txt vs current hand-tuned prompt before --live.')
    console.log('  ROLLBACK if needed: restore from /tmp/velly-pre-migration-snapshot.json')
  }
}

main().catch((e) => {
  console.error('FATAL:', e)
  console.error('\nROLLBACK from /tmp/velly-pre-migration-snapshot.json may be needed.')
  process.exit(1)
})
