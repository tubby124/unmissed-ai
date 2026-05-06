import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const { data, error } = await svc
    .from('clients')
    .select('slug, services_offered, fields_to_collect, transfer_conditions, custom_niche_config, niche_custom_variables')
    .in('slug', ['velly-remodeling', 'urban-vibe', 'calgary-property-leasing'])
  if (error) { console.error(error); process.exit(1) }
  for (const row of data ?? []) {
    const r = row as unknown as Record<string, unknown>
    console.log('━'.repeat(60))
    console.log(`SLUG: ${r.slug}`)
    const so = r.services_offered as unknown[] | null
    const ftc = r.fields_to_collect as unknown[] | null
    console.log(`services_offered (${so?.length ?? 0}):`)
    console.log(JSON.stringify(so?.slice(0, 5), null, 2))
    console.log(`...total: ${so?.length ?? 0}`)
    console.log(`fields_to_collect (${ftc?.length ?? 0}):`)
    console.log(JSON.stringify(ftc, null, 2))
    console.log(`transfer_conditions: ${r.transfer_conditions ? '"' + (r.transfer_conditions as string).slice(0, 150) + '"' : 'null'}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
