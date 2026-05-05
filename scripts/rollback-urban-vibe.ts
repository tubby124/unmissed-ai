/**
 * D445 Phase F — Urban Vibe rollback.
 *
 * Restores the pre-deploy system_prompt snapshot AND re-syncs to Ultravox.
 * Use ONLY if Phase D deploy or Phase E test calls fail.
 *
 * Run: npx tsx scripts/rollback-urban-vibe.ts
 *
 * Reads the most recent snapshot under docs/refactor-baseline/snapshots/*-pre-d445-deploy/.
 * Errors out if no snapshot exists.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { updateAgent, buildAgentTools } from '../src/lib/ultravox'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function findLatestSnapshot(): string {
  const baseDir = path.resolve('docs/refactor-baseline/snapshots')
  if (!fs.existsSync(baseDir)) throw new Error(`No snapshot dir: ${baseDir}`)
  const candidates = fs
    .readdirSync(baseDir)
    .filter((d) => d.endsWith('-pre-d445-deploy'))
    .sort()
    .reverse()
  if (candidates.length === 0) {
    throw new Error('No *-pre-d445-deploy snapshot found. Did deploy-urban-vibe.ts run first?')
  }
  const latest = path.join(baseDir, candidates[0], 'urban-vibe-system-prompt.txt')
  if (!fs.existsSync(latest)) throw new Error(`Snapshot missing: ${latest}`)
  return latest
}

async function main() {
  console.log('[1/4] Locating snapshot…')
  const snapshotPath = findLatestSnapshot()
  const oldPrompt = fs.readFileSync(snapshotPath, 'utf-8')
  console.log(`  using ${snapshotPath} (${oldPrompt.length} chars)`)

  console.log('[2/4] Resolving client + Ultravox agent…')
  const { data: clientRaw, error: clientErr } = await svc
    .from('clients')
    .select(
      'id, ultravox_agent_id, agent_voice_id, slug, niche, business_name, agent_name, ' +
      'booking_enabled, forwarding_number, transfer_conditions, sms_enabled, twilio_number, ' +
      'knowledge_backend, selected_plan, subscription_status, after_hours_behavior',
    )
    .eq('slug', 'urban-vibe')
    .limit(1)
    .maybeSingle()
  if (clientErr || !clientRaw) throw new Error(`urban-vibe lookup failed: ${clientErr?.message ?? 'not found'}`)
  const client = clientRaw as unknown as {
    id: string
    ultravox_agent_id: string | null
    agent_voice_id: string | null
    slug: string
    niche: string | null
    business_name: string | null
    agent_name: string | null
    booking_enabled: boolean | null
    forwarding_number: string | null
    transfer_conditions: string | null
    sms_enabled: boolean | null
    twilio_number: string | null
    knowledge_backend: string | null
    selected_plan: string | null
    subscription_status: string | null
    after_hours_behavior: string | null
  }

  console.log(`  client.id=${client.id} agent_id=${client.ultravox_agent_id ?? '(none)'}`)

  console.log('[3/4] Writing snapshot back to clients.system_prompt…')
  const { error: updErr } = await svc
    .from('clients')
    .update({ system_prompt: oldPrompt, updated_at: new Date().toISOString() })
    .eq('id', client.id)
  if (updErr) throw new Error(`DB update failed: ${updErr.message}`)
  console.log('  DB rolled back.')

  if (!client.ultravox_agent_id) {
    console.log('[4/4] No Ultravox agent — DB-only rollback complete.')
    return
  }

  console.log('[4/4] Re-syncing Ultravox agent with old prompt…')
  const flags = {
    systemPrompt: oldPrompt,
    voice: client.agent_voice_id ?? undefined,
    slug: client.slug,
    niche: client.niche,
    business_name: client.business_name,
    agent_name: client.agent_name,
    booking_enabled: !!client.booking_enabled,
    forwarding_number: client.forwarding_number,
    transfer_conditions: client.transfer_conditions,
    sms_enabled: !!client.sms_enabled,
    twilio_number: client.twilio_number,
    knowledge_backend: client.knowledge_backend,
    selected_plan: client.selected_plan,
    subscription_status: client.subscription_status,
    after_hours_behavior: client.after_hours_behavior,
  }
  await updateAgent(client.ultravox_agent_id, flags as Parameters<typeof updateAgent>[1])
  const restoredTools = buildAgentTools(flags as Parameters<typeof buildAgentTools>[0])
  await svc
    .from('clients')
    .update({
      tools: restoredTools,
      last_agent_sync_at: new Date().toISOString(),
      last_agent_sync_status: 'success',
    })
    .eq('id', client.id)
  console.log(`  Ultravox synced. Tools rebuilt: ${restoredTools.length}`)

  console.log('')
  console.log('Rollback complete. Next steps:')
  console.log('  - Confirm with one test call to +14036057142')
  console.log('  - Open a follow-up D-item describing what failed')
  console.log('  - Decide: retry with fix, or hold migration')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
