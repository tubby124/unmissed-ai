import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const { data, error } = await svc
    .from('clients')
    .select('slug, services_offered, fields_to_collect')
    .in('slug', ['velly-remodeling', 'urban-vibe', 'windshield-hub'])
  if (error) { console.error(error); process.exit(1) }
  for (const row of data ?? []) {
    const r = row as unknown as Record<string, unknown>
    console.log('━'.repeat(60))
    console.log(`SLUG: ${r.slug}`)
    const so = r.services_offered
    console.log(`services_offered typeof: ${typeof so}, isArray: ${Array.isArray(so)}, length/raw:`)
    if (typeof so === 'string') {
      console.log(`  STRING (${(so as string).length} chars): "${(so as string).slice(0, 250)}${(so as string).length > 250 ? '...' : ''}"`)
    } else if (Array.isArray(so)) {
      console.log(`  ARRAY (${so.length}): ${JSON.stringify(so.slice(0, 3))}...`)
    } else {
      console.log('  null')
    }
    const ftc = r.fields_to_collect
    console.log(`fields_to_collect typeof: ${typeof ftc}, isArray: ${Array.isArray(ftc)}`)
    console.log(`  raw: ${JSON.stringify(ftc)}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
