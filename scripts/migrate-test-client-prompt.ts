import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { buildPromptFromSlots, buildSlotContext } from '../src/lib/prompt-slots'
import { clientRowToIntake } from '../src/lib/slot-regenerator'
import { updateAgent, buildAgentTools } from '../src/lib/ultravox'

loadEnv({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const CLIENT_ID = '00e82ba2-ad66-422a-a20a-740af01e7c49'
  const { data: client, error } = await sb.from('clients').select('*').eq('id', CLIENT_ID).single()
  if (error || !client) { console.error('client not found:', error?.message); process.exit(1) }
  const { data: services } = await sb.from('client_services').select('*').eq('client_id', CLIENT_ID).eq('active', true).order('sort_order').order('created_at')
  const intake = clientRowToIntake(client as Record<string, unknown>, services ?? [], 0)
  const ctx = buildSlotContext(intake)
  const newPrompt = buildPromptFromSlots(ctx)
  console.log('new prompt length:', newPrompt.length)
  console.log('has markers:', newPrompt.includes('<!-- SLOT:'))
  const { error: updateErr } = await sb.from('clients').update({ system_prompt: newPrompt, updated_at: new Date().toISOString() }).eq('id', CLIENT_ID)
  if (updateErr) { console.error('update failed:', updateErr.message); process.exit(1) }
  console.log('DB updated.')
  if (client.ultravox_agent_id) {
    const flags = {
      systemPrompt: newPrompt,
      voice: client.agent_voice_id ?? undefined,
      slug: client.slug,
      niche: client.niche,
      business_name: client.business_name,
      agent_name: client.agent_name,
      booking_enabled: !!client.booking_enabled,
      forwarding_number: client.forwarding_number ?? null,
      transfer_conditions: client.transfer_conditions ?? null,
      sms_enabled: !!client.sms_enabled,
      twilio_number: client.twilio_number ?? null,
      knowledge_backend: client.knowledge_backend ?? null,
      selected_plan: client.selected_plan,
      subscription_status: client.subscription_status,
      after_hours_behavior: client.after_hours_behavior ?? null,
    }
    await updateAgent(client.ultravox_agent_id, flags as Parameters<typeof updateAgent>[1])
    const syncTools = buildAgentTools(flags as Parameters<typeof buildAgentTools>[0])
    await sb.from('clients').update({ tools: syncTools, last_agent_sync_at: new Date().toISOString(), last_agent_sync_status: 'success' }).eq('id', CLIENT_ID)
    console.log('Ultravox synced. Tools:', syncTools.length)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
