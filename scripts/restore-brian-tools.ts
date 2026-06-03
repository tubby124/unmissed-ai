// Emergency restore: re-sync Brian's clients.tools to include submitMaintenanceRequest.
// Fixes the regression caused by buildAgentFlagsFromClient missing `niche` field.
// Read-then-write — safe to re-run.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { buildAgentTools } from '../src/lib/ultravox'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: client } = await svc.from('clients').select('*').eq('id', CLIENT_ID).single()
  if (!client) throw new Error('not found')

  // Count approved chunks for knowledge tool gating
  let chunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', CLIENT_ID).eq('status', 'approved')
    chunkCount = count ?? 0
  }

  const flags: any = {
    systemPrompt: client.system_prompt,
    ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
    booking_enabled: client.booking_enabled ?? false,
    slug: client.slug,
    forwarding_number: (client.forwarding_number as string | null) || undefined,
    sms_enabled: client.sms_enabled ?? false,
    twilio_number: (client.twilio_number as string | null) || undefined,
    knowledge_backend: client.knowledge_backend,
    knowledge_chunk_count: chunkCount,
    transfer_conditions: client.transfer_conditions,
    selectedPlan: (client.selected_plan as string | null) || undefined,
    subscriptionStatus: (client.subscription_status as string | null) || undefined,
    niche: client.niche,
  }

  const tools = buildAgentTools(flags)
  const names = tools.map((t: any) => t.toolName || t.nameOverride || t.temporaryTool?.modelToolName || '?')
  console.log('Rebuilt tools (with niche):')
  for (const n of names) console.log(`  - ${n}`)

  const hasMaintenance = names.includes('submitMaintenanceRequest')
  if (!hasMaintenance) {
    console.error('\nBUG STILL PRESENT — submitMaintenanceRequest NOT in rebuild. Aborting write.')
    process.exit(1)
  }

  console.log(`\n→ Writing ${tools.length} tools to clients.tools...`)
  const { error } = await svc.from('clients').update({ tools, updated_at: new Date().toISOString() }).eq('id', CLIENT_ID)
  if (error) {
    console.error('Write failed:', error.message)
    process.exit(1)
  }
  console.log('✓ clients.tools restored.')
  console.log('\nNOTE: This only updates clients.tools (runtime-authoritative).')
  console.log('Ultravox stored agent tools are overridden per call by toolOverrides anyway.')
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
