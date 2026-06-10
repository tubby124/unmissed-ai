import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
async function main() {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await svc.from('knowledge_query_log').select('*').limit(1).maybeSingle()
  if (error) { console.error('Error:', error); process.exit(1) }
  if (!data) { console.log('Table empty — no row to inspect, but columns are:'); return }
  console.log('knowledge_query_log columns:')
  for (const k of Object.keys(data)) console.log(`  ${k}: ${typeof (data as Record<string,unknown>)[k]} (${(data as Record<string,unknown>)[k]})`)
}
main()
