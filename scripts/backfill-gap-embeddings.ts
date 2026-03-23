/**
 * Backfill script: adds query_embedding to existing zero-result knowledge_query_log rows.
 * Run: npx tsx scripts/backfill-gap-embeddings.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://qwhvblomlgeapzhnuwlb.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseKey || !openaiKey) {
  console.error('Missing env vars: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY), OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function embedText(text: string): Promise<number[] | null> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  if (!res.ok) {
    console.error(`Embed failed: HTTP ${res.status}`)
    return null
  }
  const data = await res.json()
  return data.data?.[0]?.embedding ?? null
}

async function backfill() {
  const { data: rows, error } = await supabase
    .from('knowledge_query_log')
    .select('id, query_text')
    .eq('result_count', 0)
    .is('resolved_at', null)
    .is('query_embedding', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Fetch error:', error.message)
    return
  }
  console.log(`Found ${rows?.length ?? 0} gaps to backfill`)

  let success = 0
  let failed = 0
  for (const row of rows ?? []) {
    const embedding = await embedText(row.query_text)
    if (!embedding) { failed++; continue }

    const { error: updateErr } = await supabase
      .from('knowledge_query_log')
      .update({ query_embedding: JSON.stringify(embedding) })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`Update failed for ${row.id}:`, updateErr.message)
      failed++
    } else {
      success++
    }

    // Rate limit safety
    await new Promise(r => setTimeout(r, 50))
  }
  console.log(`Backfill complete: ${success} success, ${failed} failed`)
}

backfill().catch(console.error)
