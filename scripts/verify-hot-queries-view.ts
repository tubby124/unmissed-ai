import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
async function main() {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await svc.from('v_hot_knowledge_queries').select('*').limit(5)
  if (error) { console.error('Error:', error); process.exit(1) }
  console.log(`v_hot_knowledge_queries rows: ${data?.length ?? 0}`)
  for (const r of (data ?? [])) {
    console.log(`  ${(r as Record<string,unknown>).niche} | "${(r as Record<string,unknown>).normalized_query}" | 30d=${(r as Record<string,unknown>).hit_count_30d} | 90d=${(r as Record<string,unknown>).hit_count_90d} | res=${(r as Record<string,unknown>).resolution_rate_pct}%`)
  }
  const { data: niche, error: nErr } = await svc.from('v_hot_knowledge_queries_by_niche').select('*').limit(5)
  if (nErr) { console.error('Niche view error:', nErr); process.exit(1) }
  console.log(`\nv_hot_knowledge_queries_by_niche rows: ${niche?.length ?? 0}`)
  for (const r of (niche ?? [])) {
    console.log(`  ${(r as Record<string,unknown>).niche} | "${(r as Record<string,unknown>).normalized_query}" | clients=${(r as Record<string,unknown>).clients_affected} | 30d=${(r as Record<string,unknown>).total_hits_30d}`)
  }
}
main()
