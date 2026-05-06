/**
 * D445 Snowflake Audit — read-only DB inspection of all 4 founding clients
 * + Velly (the canonical slot-framework example) for comparison.
 *
 * Goal: understand owner_name, custom_niche_config, niche_custom_variables
 * fields across clients to plan windshield-hub backfill.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('missing env'); process.exit(1) }

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const SLUGS = ['windshield-hub', 'urban-vibe', 'hasan-sharif', 'exp-realty', 'velly-remodeling']

async function main() {
  const { data, error } = await svc
    .from('clients')
    .select('slug, niche, business_name, agent_name, owner_name, hand_tuned, ' +
      'custom_niche_config, niche_custom_variables, services_offered, ' +
      'fields_to_collect, transfer_conditions, voice_style_preset, ' +
      'business_facts, extra_qa, sms_enabled, forwarding_number')
    .in('slug', SLUGS)
  if (error) { console.error(error); process.exit(1) }
  for (const row of data ?? []) {
    const r = row as unknown as Record<string, unknown>
    console.log('━'.repeat(60))
    console.log(`SLUG: ${r.slug}`)
    console.log(`niche=${r.niche}  hand_tuned=${r.hand_tuned}  voice_style=${r.voice_style_preset}`)
    console.log(`business_name="${r.business_name}"  agent_name="${r.agent_name}"  owner_name="${r.owner_name ?? ''}"`)
    console.log(`sms_enabled=${r.sms_enabled}  forwarding_number=${r.forwarding_number ?? 'null'}  transfer_conditions=${r.transfer_conditions ? '"' + (r.transfer_conditions as string).slice(0, 60) + '..."' : 'null'}`)
    const cnc = r.custom_niche_config as Record<string, unknown> | null
    if (cnc) {
      console.log(`custom_niche_config keys: ${Object.keys(cnc).join(', ')}`)
      console.log(`  close_person="${cnc.close_person ?? ''}"`)
      console.log(`  close_action="${cnc.close_action ?? ''}"`)
      console.log(`  industry="${cnc.industry ?? ''}"`)
    } else {
      console.log('custom_niche_config: null')
    }
    const ncv = r.niche_custom_variables as Record<string, unknown> | null
    console.log(`niche_custom_variables: ${ncv ? Object.keys(ncv).join(', ') || '(empty obj)' : 'null'}`)
    if (ncv) {
      for (const [k, v] of Object.entries(ncv)) {
        const vs = typeof v === 'string' ? v : JSON.stringify(v)
        console.log(`  ${k} = ${vs.slice(0, 100)}${vs.length > 100 ? '...' : ''}`)
      }
    }
    const so = r.services_offered as unknown[] | null
    const ftc = r.fields_to_collect as unknown[] | null
    const bf = r.business_facts as unknown[] | null
    const eq = r.extra_qa as unknown[] | null
    console.log(`services_offered: ${so === null ? 'null' : `${so.length} items`}`)
    console.log(`fields_to_collect: ${ftc === null ? 'null' : `${ftc.length} items`}`)
    console.log(`business_facts: ${bf === null ? 'null' : `${bf.length} items`}`)
    console.log(`extra_qa: ${eq === null ? 'null' : `${eq.length} items`}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
