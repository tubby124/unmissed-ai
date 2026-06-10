/**
 * One-off: change agent_voice_id on a single client and sync the live Ultravox agent.
 *
 * Usage:
 *   npx tsx scripts/one-off-set-voice.ts --slug=hasan-sharif --voice=aa601962-...
 *
 * Mirrors the work the dashboard /api/dashboard/settings PATCH route does for
 * agent_voice_id (DB_PLUS_TOOLS mutation): DB write + needsAgentSync + updateAgent().
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { updateAgent, buildAgentTools } from '../src/lib/ultravox.js'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

async function main() {
  const slug = arg('slug')
  const voiceId = arg('voice')
  if (!slug || !voiceId) {
    console.error('Usage: --slug=<slug> --voice=<voiceId>')
    process.exit(2)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  const supabase = createClient(url, key)

  // 1. Fetch full client row needed by updateAgent
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, slug, ultravox_agent_id, agent_voice_id, agent_name, system_prompt, niche, call_handling_mode, booking_enabled, knowledge_backend, sms_enabled, twilio_number, forwarding_number, transfer_conditions, selected_plan, subscription_status, business_name, timezone')
    .eq('slug', slug)
    .single()

  if (error || !client) throw new Error(`Client not found: ${slug} (${error?.message})`)
  if (!client.ultravox_agent_id) throw new Error(`No ultravox_agent_id on ${slug}`)

  console.log(`[voice-swap] ${slug}: ${client.agent_voice_id} → ${voiceId}`)

  // 2. DB write
  const { error: updErr } = await supabase
    .from('clients')
    .update({ agent_voice_id: voiceId })
    .eq('id', client.id)

  if (updErr) throw new Error(`DB update failed: ${updErr.message}`)
  console.log('[voice-swap] DB updated')

  // 3. Ultravox live agent sync — voice-only swap.
  //    PATCH callTemplate.voice without touching systemPrompt or selectedTools.
  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) throw new Error('Missing ULTRAVOX_API_KEY')

  // Read current agent first so PATCH preserves everything else.
  const getRes = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!getRes.ok) throw new Error(`GET agent failed: ${getRes.status} ${await getRes.text()}`)
  const currentAgent = await getRes.json() as { callTemplate?: Record<string, unknown> }

  const callTemplate = { ...(currentAgent.callTemplate || {}), voice: voiceId }

  const patchRes = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ callTemplate }),
  })
  if (!patchRes.ok) throw new Error(`PATCH agent failed: ${patchRes.status} ${await patchRes.text()}`)
  console.log('[voice-swap] Ultravox agent updated (voice only, callTemplate preserved)')

  // 4. last_agent_sync_at bump
  await supabase
    .from('clients')
    .update({ last_agent_sync_at: new Date().toISOString(), last_agent_sync_status: 'success' })
    .eq('id', client.id)

  console.log('[voice-swap] Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
