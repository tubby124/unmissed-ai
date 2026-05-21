/**
 * resync-exp-realty.ts — one-shot DB → Ultravox prompt resync for exp-realty.
 *
 * Why: 2026-05-21 nightly drift check found exp-realty's saved system_prompt
 * is 1,457 chars longer than what's deployed to Ultravox. Owner confirmed
 * client is dormant — safe to push DB authoritative version live.
 *
 * Modeled on src/app/api/admin/sync-agents/route.ts but skips Basic-auth and
 * runs against one slug only. Reads all the gating columns updateAgent()
 * needs so tools rebuild correctly from current entitlements.
 *
 * Run:
 *   npx tsx scripts/resync-exp-realty.ts             # dry-run preview
 *   npx tsx scripts/resync-exp-realty.ts --live      # actually push
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { updateAgent, buildAgentTools } from '../src/lib/ultravox.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY
const SLUG = 'exp-realty'
const LIVE = process.argv.includes('--live')

if (!SUPABASE_URL || !SERVICE_KEY || !ULTRAVOX_API_KEY) {
  console.error('Missing required env')
  process.exit(2)
}

async function main(): Promise<number> {
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

  const { data: client, error } = await sb
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, booking_enabled, ultravox_agent_id, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, niche')
    .eq('slug', SLUG)
    .maybeSingle()

  if (error || !client) {
    console.error(`[resync] failed to load client ${SLUG}: ${error?.message ?? 'not found'}`)
    return 1
  }
  if (!client.ultravox_agent_id) {
    console.error('[resync] no ultravox_agent_id — nothing to sync')
    return 1
  }
  if (!client.system_prompt) {
    console.error('[resync] no system_prompt in DB — refusing to deploy empty')
    return 1
  }

  // Fetch live for comparison
  const res = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
    headers: { 'X-API-Key': ULTRAVOX_API_KEY! },
  })
  if (!res.ok) {
    console.error(`[resync] failed to GET agent: HTTP ${res.status}`)
    return 1
  }
  const agentData = await res.json() as { callTemplate?: { systemPrompt?: string } }
  const liveSp = agentData.callTemplate?.systemPrompt ?? ''
  const dbSp = client.system_prompt

  console.log(`[resync] slug=${SLUG}`)
  console.log(`[resync] DB prompt    : ${dbSp.length} chars`)
  console.log(`[resync] Live prompt  : ${liveSp.length} chars`)
  console.log(`[resync] Δ            : ${dbSp.length - liveSp.length} chars`)

  let knowledgeChunkCount: number | undefined
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await sb
      .from('knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'approved')
    knowledgeChunkCount = count ?? 0
    console.log(`[resync] knowledge_chunks (approved): ${knowledgeChunkCount}`)
  }

  const agentFlags: Parameters<typeof updateAgent>[1] = {
    systemPrompt: dbSp,
    ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
    booking_enabled: client.booking_enabled ?? false,
    slug: client.slug,
    forwarding_number: client.forwarding_number || undefined,
    transfer_conditions: client.transfer_conditions || undefined,
    sms_enabled: client.sms_enabled ?? false,
    twilio_number: client.twilio_number || undefined,
    knowledge_backend: client.knowledge_backend || undefined,
    knowledge_chunk_count: knowledgeChunkCount,
    selectedPlan: client.selected_plan || undefined,
    subscriptionStatus: client.subscription_status || undefined,
    niche: client.niche || undefined,
  }

  if (!LIVE) {
    console.log('[resync] DRY RUN — pass --live to actually push')
    console.log(`[resync] would call updateAgent(${client.ultravox_agent_id}, { systemPrompt: <${dbSp.length} chars>, ... })`)
    return 0
  }

  console.log('[resync] Pushing DB → Ultravox …')
  await updateAgent(client.ultravox_agent_id, agentFlags)

  const syncTools = buildAgentTools(agentFlags)
  const { error: toolsErr } = await sb.from('clients').update({ tools: syncTools }).eq('id', client.id)
  if (toolsErr) {
    console.warn(`[resync] tools sync failed: ${toolsErr.message}`)
  }

  console.log(`[resync] Done. Wrote ${dbSp.length} chars to Ultravox and ${syncTools.length} tool(s) to clients.tools.`)
  return 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(2) })
