// P2 — Knowledge corpus health check for Brian.
// Read-only. Counts knowledge_chunks by source + status, plus a sample of recent queries.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log('=== KNOWLEDGE CHUNKS BREAKDOWN ===\n')
  const { data: chunks, error } = await svc
    .from('knowledge_chunks')
    .select('id, source, status, content, created_at')
    .eq('client_id', CLIENT_ID)

  if (error) {
    console.error('chunks query failed:', error.message)
  } else {
    const rows = (chunks ?? []) as any[]
    if (rows.length === 0) {
      console.log('NO CHUNKS — corpus is empty. queryKnowledge would return nothing.')
    } else {
      const buckets = new Map<string, { count: number; avgChars: number; total: number }>()
      for (const r of rows) {
        const key = `${r.source}|${r.status}`
        const ex = buckets.get(key) ?? { count: 0, avgChars: 0, total: 0 }
        ex.count++
        ex.total += (r.content || '').length
        buckets.set(key, ex)
      }
      console.log(`Total chunks: ${rows.length}`)
      console.log('| Source | Status | Chunks | Avg chars |')
      console.log('|---|---|---:|---:|')
      for (const [key, b] of Array.from(buckets.entries()).sort((a, b) => b[1].count - a[1].count)) {
        const [source, status] = key.split('|')
        console.log(`| ${source} | ${status} | ${b.count} | ${Math.round(b.total / b.count)} |`)
      }
      console.log(`\nNewest chunk created: ${rows.map(r => r.created_at).sort().reverse()[0]}`)
      console.log(`Oldest chunk created: ${rows.map(r => r.created_at).sort()[0]}`)
    }
  }

  console.log('\n=== KNOWLEDGE QUERY LOG (last 20) ===\n')
  const { data: queries, error: qErr } = await svc
    .from('knowledge_query_log')
    .select('query_text, resolved, source_chunk_ids, created_at')
    .eq('client_id', CLIENT_ID)
    .order('created_at', { ascending: false })
    .limit(20)

  if (qErr) {
    console.log(`(no knowledge_query_log table or query failed: ${qErr.message})`)
  } else {
    const rows = (queries ?? []) as any[]
    if (rows.length === 0) {
      console.log('NO QUERIES LOGGED — queryKnowledge never fired or never persisted to log.')
    } else {
      let resolved = 0
      for (const q of rows) {
        if (q.resolved) resolved++
        console.log(`[${q.resolved ? 'RESOLVED' : 'gap'}] ${q.query_text?.slice(0, 80)}`)
      }
      console.log(`\nResolved rate: ${resolved}/${rows.length} = ${Math.round(resolved * 100 / rows.length)}%`)
    }
  }

  console.log('\n=== CLIENT KNOWLEDGE CONFIG ===\n')
  const { data: client } = await svc.from('clients').select('knowledge_backend, website_url, website_scrape_status, extra_qa, business_facts').eq('id', CLIENT_ID).single()
  if (client) {
    console.log(`knowledge_backend: ${client.knowledge_backend}`)
    console.log(`website_url: ${client.website_url ?? '(none)'}`)
    console.log(`website_scrape_status: ${client.website_scrape_status ?? '(none)'}`)
    console.log(`extra_qa entries: ${Array.isArray(client.extra_qa) ? client.extra_qa.length : (client.extra_qa ? 'object' : 0)}`)
    console.log(`business_facts: ${Array.isArray(client.business_facts) ? `${client.business_facts.length} entries` : (client.business_facts ? `${(client.business_facts as string).length} chars (string)` : '(none)')}`)
  }

  console.log('\n=== DIAGNOSIS ===\n')
  const { count: approvedCount } = await svc.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', CLIENT_ID).eq('status', 'approved')
  const { count: pendingCount } = await svc.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', CLIENT_ID).eq('status', 'pending')
  const totalApproved = approvedCount ?? 0
  const totalPending = pendingCount ?? 0
  console.log(`Approved chunks: ${totalApproved}`)
  console.log(`Pending chunks: ${totalPending}`)
  if (totalApproved === 0 && totalPending > 0) {
    console.log('→ Chunks exist but none approved. Fix: re-approve via /api/dashboard/knowledge/compile/apply.')
  } else if (totalApproved === 0 && totalPending === 0) {
    console.log('→ Corpus is empty. Fix: re-scrape website OR re-run /api/dashboard/knowledge/compile.')
  } else if (totalApproved > 0) {
    console.log(`→ Corpus has ${totalApproved} approved chunks. queryKnowledge SHOULD fire on policy questions.`)
    console.log(`  If production 0% rate persists with non-empty corpus → prompt routing bug, not corpus bug.`)
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
