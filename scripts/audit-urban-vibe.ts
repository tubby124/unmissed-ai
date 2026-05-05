import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const { data, error } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, agent_name, agent_voice_id, niche_custom_variables, business_facts, extra_qa, ultravox_agent_id, last_agent_sync_status, twilio_number, forwarding_number, transfer_conditions, booking_enabled, sms_enabled, knowledge_backend, selected_plan, subscription_status, ivr_enabled, after_hours_behavior, injected_note, system_prompt')
    .eq('slug', 'urban-vibe')
    .limit(1)
    .maybeSingle()
  if (error || !data) { console.error('lookup failed:', error); process.exit(1) }
  const d = data as Record<string, unknown>
  const sp = d.system_prompt as string | null
  console.log(JSON.stringify({
    ...d,
    system_prompt_length: sp?.length ?? 0,
    has_slot_markers: sp?.includes('<!-- unmissed:identity -->') ?? false,
    business_facts_preview: typeof d.business_facts === 'string' ? (d.business_facts as string).slice(0, 300) : d.business_facts,
    extra_qa_count: Array.isArray(d.extra_qa) ? (d.extra_qa as unknown[]).length : 0,
    extra_qa_sample: Array.isArray(d.extra_qa) ? (d.extra_qa as unknown[]).slice(0, 3) : null,
    system_prompt: undefined,
  }, null, 2))
  const { count } = await svc.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', d.id as string).eq('status', 'approved')
  console.log('approved knowledge_chunks:', count)
}
main().catch(e => { console.error(e); process.exit(1) })
