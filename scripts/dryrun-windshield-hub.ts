/**
 * D445 Windshield-Hub Snowflake Migration — Dry-Run Phase A
 *
 * READ-ONLY. Calls recomposePrompt(clientId, userId, dryRun=true, forceRecompose=true).
 * forceRecompose=true is REQUIRED because windshield-hub has hand_tuned=true
 * (PR #81 guard added 2026-05-05). The dryRun branch returns the new prompt
 * BEFORE any DB write, prompt_versions insert, updateAgent() call, or
 * syncClientTools() call. This script writes ONLY local files in
 * CALLINGAGENTS/00-Inbox/.
 *
 * Outputs:
 *   - windshield-hub-snowflake-pre-migration.json (current DB state)
 *   - windshield-hub-snowflake-dryrun.json (recomposePrompt result with preview + currentPrompt)
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

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const OUT_DIR = path.resolve('CALLINGAGENTS/00-Inbox')
const SLUG = 'windshield-hub'

async function main() {
  console.log(`[1/5] Looking up ${SLUG} client row...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select(
      'id, slug, niche, business_name, agent_name, agent_voice_id, voice_style_preset, ' +
      'system_prompt, niche_custom_variables, business_facts, extra_qa, ' +
      'context_data, tools, last_agent_sync_at, last_agent_sync_status, ' +
      'ultravox_agent_id, twilio_number, forwarding_number, transfer_conditions, ' +
      'booking_enabled, sms_enabled, knowledge_backend, selected_plan, ' +
      'subscription_status, business_hours_weekday, business_hours_weekend, ' +
      'after_hours_behavior, after_hours_emergency_phone, injected_note, timezone, ' +
      'ivr_enabled, call_handling_mode, classification_rules, hand_tuned, ' +
      'services_offered, fields_to_collect'
    )
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    throw new Error(`${SLUG} lookup failed: ${clientErr?.message ?? 'not found'}`)
  }
  const clientRow = client as unknown as { id: string; system_prompt: string | null; hand_tuned: boolean | null }
  console.log(`  client.id=${clientRow.id}, system_prompt=${clientRow.system_prompt?.length ?? 0} chars, hand_tuned=${clientRow.hand_tuned}`)

  console.log('[2/5] Counting approved knowledge chunks...')
  const { count: chunkCount } = await svc
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientRow.id)
    .eq('status', 'approved')
  console.log(`  approved chunks: ${chunkCount ?? 0}`)

  console.log('[3/5] Resolving an admin user_id (for prompt_versions audit row)...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, client_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (cuErr || !adminCu?.user_id) {
    throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty result'}`)
  }
  console.log(`  admin user_id=${adminCu.user_id}`)

  console.log('[4/5] Writing pre-migration snapshot...')
  const preMigrationPath = path.join(OUT_DIR, `${SLUG}-snowflake-pre-migration.json`)
  const snapshot = { ...(client as unknown as Record<string, unknown>), _approved_chunk_count: chunkCount }
  fs.writeFileSync(preMigrationPath, JSON.stringify(snapshot, null, 2))
  console.log(`  wrote ${preMigrationPath}`)

  console.log('[5/5] Running recomposePrompt(dryRun=true, forceRecompose=true)...')
  const result = await recomposePrompt(
    clientRow.id,
    adminCu.user_id as string,
    /* dryRun */ true,
    /* forceRecompose */ true,
  )

  const dryrunPath = path.join(OUT_DIR, `${SLUG}-snowflake-dryrun.json`)
  fs.writeFileSync(dryrunPath, JSON.stringify(result, null, 2))
  console.log(`  wrote ${dryrunPath}`)

  console.log('')
  console.log('=== RESULT ===')
  console.log(`  success=${result.success}`)
  console.log(`  promptChanged=${result.promptChanged}`)
  console.log(`  charCount=${result.charCount ?? 'n/a'}`)
  console.log(`  error=${result.error ?? 'none'}`)
  console.log(`  preview length=${result.preview?.length ?? 0}`)
  console.log(`  currentPrompt length=${result.currentPrompt?.length ?? 0}`)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
