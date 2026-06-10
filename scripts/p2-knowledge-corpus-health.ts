// P2 — Brian's knowledge corpus health check.
// Handoff specified `psql "$DATABASE_URL"` but only Supabase JS creds exist in .env.local.
// Same query semantics: group knowledge_chunks by (source, status), count rows + avg chars.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39' // calgary-property-leasing / Brian / Eric

async function main(): Promise<void> {
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Read knowledge_backend + slug for sanity
  const { data: client, error: cErr } = await svc
    .from('clients')
    .select('slug, knowledge_backend, niche')
    .eq('id', CLIENT_ID)
    .single()
  if (cErr || !client) throw new Error(`client lookup failed: ${cErr?.message}`)

  console.log(`client: ${client.slug} (${client.niche}) · knowledge_backend=${client.knowledge_backend}`)
  console.log('')

  // Pull all chunks for the client. Postgres group-by isn't exposed via Supabase JS;
  // fetch the rows and aggregate in-process (Brian's corpus is small enough).
  const { data: chunks, error: kErr } = await svc
    .from('knowledge_chunks')
    .select('source, status, content')
    .eq('client_id', CLIENT_ID)
  if (kErr) throw new Error(`chunks query failed: ${kErr.message}`)

  if (!chunks || chunks.length === 0) {
    console.log('NO knowledge_chunks rows for this client.')
    console.log('=> queryKnowledge tool fires against an empty corpus = 0% hit rate guaranteed.')
    console.log('=> Bug 3 prompt fix will NOT recover policy-question handling.')
    console.log('=> Action: re-run /api/dashboard/knowledge/compile or seedKnowledgeFromScrape.')
    return
  }

  type Bucket = { count: number; totalChars: number }
  const groups = new Map<string, Bucket>()
  for (const row of chunks) {
    const key = `${row.source ?? '(null)'} | ${row.status ?? '(null)'}`
    const b = groups.get(key) ?? { count: 0, totalChars: 0 }
    b.count += 1
    b.totalChars += (row.content ?? '').length
    groups.set(key, b)
  }

  const rows = [...groups.entries()]
    .map(([key, b]) => ({ key, count: b.count, avgChars: Math.round(b.totalChars / b.count) }))
    .sort((a, b) => b.count - a.count)

  console.log('source | status                     | chunks | avg_chars')
  console.log('-'.repeat(62))
  for (const r of rows) {
    console.log(`${r.key.padEnd(45)} ${String(r.count).padStart(6)}   ${String(r.avgChars).padStart(7)}`)
  }
  console.log('-'.repeat(62))
  const total = rows.reduce((s, r) => s + r.count, 0)
  const approved = rows.filter(r => r.key.endsWith('| approved')).reduce((s, r) => s + r.count, 0)
  console.log(`TOTAL: ${total} chunks · approved: ${approved}`)

  console.log('')
  if (approved === 0) {
    console.log('VERDICT: No approved chunks. queryKnowledge returns nothing.')
    console.log('=> Prompt fix is independent of this; corpus needs to be approved/reseeded.')
  } else if (approved < 5) {
    console.log(`VERDICT: Only ${approved} approved chunks. Likely too sparse for the policy questions.`)
    console.log('=> Re-run compiler or accept that knowledge fallback (Brian callback) is the design.')
  } else {
    console.log(`VERDICT: ${approved} approved chunks present. Corpus is populated.`)
    console.log('=> 0% queryKnowledge hit rate is a ROUTING bug, not a corpus emptiness bug.')
    console.log('=> Investigate retrieval_instruction wording or pgvector similarity threshold.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
