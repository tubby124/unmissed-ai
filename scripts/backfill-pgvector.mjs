#!/usr/bin/env node
/**
 * One-shot backfill script: embed windshield-hub business_facts + extra_qa into knowledge_chunks.
 * Uses OPENROUTER_API_KEY for embeddings, SUPABASE_SERVICE_ROLE_KEY for DB writes.
 * Run: node scripts/backfill-pgvector.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

// ── Load .env.local ─────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENROUTER_KEY = env.OPENROUTER_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_KEY) {
  console.error('Missing required env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const CLIENT_SLUG = 'windshield-hub'

// ── Embed text via OpenRouter ───────────────────────────────────────────────
async function embedText(text) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '(unreadable)')
    console.error(`Embedding failed HTTP ${res.status}: ${err.slice(0, 200)}`)
    return null
  }

  const data = await res.json()
  const embedding = data.data?.[0]?.embedding
  if (!embedding || embedding.length !== 1536) {
    console.error(`Bad embedding dimension: ${embedding?.length}`)
    return null
  }
  return embedding
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load client
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, slug, business_facts, extra_qa')
    .eq('slug', CLIENT_SLUG)
    .single()

  if (error || !client) {
    console.error('Client not found:', error)
    process.exit(1)
  }

  console.log(`Client: ${client.slug} (${client.id})`)

  // 2. Prepare chunks
  const chunks = []

  // Facts
  if (client.business_facts) {
    const lines = client.business_facts.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
    for (const line of lines) {
      chunks.push({ content: line, chunkType: 'fact', source: 'website_scrape' })
    }
  }

  // QA
  const qa = Array.isArray(client.extra_qa) ? client.extra_qa : []
  for (const pair of qa) {
    if (pair.q?.trim() && pair.a?.trim()) {
      chunks.push({
        content: `Q: ${pair.q.trim()}\nA: ${pair.a.trim()}`,
        chunkType: 'qa',
        source: 'website_scrape',
      })
    }
  }

  console.log(`Prepared ${chunks.length} chunks (${chunks.filter(c => c.chunkType === 'fact').length} facts, ${chunks.filter(c => c.chunkType === 'qa').length} QA)`)

  if (chunks.length === 0) {
    console.error('No chunks to embed')
    process.exit(1)
  }

  // 3. Delete old website_scrape chunks
  const { data: deleted } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('client_id', client.id)
    .eq('source', 'website_scrape')
    .select('id')

  console.log(`Deleted ${deleted?.length ?? 0} old chunks`)

  // 4. Embed and insert each chunk
  const sourceRunId = randomUUID()
  let stored = 0
  let failed = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    process.stdout.write(`  [${i + 1}/${chunks.length}] Embedding "${chunk.content.slice(0, 50)}..." `)

    const embedding = await embedText(chunk.content)
    if (!embedding) {
      console.log('FAILED')
      failed++
      continue
    }

    const { error: insertErr } = await supabase
      .from('knowledge_chunks')
      .upsert({
        client_id: client.id,
        content: chunk.content,
        chunk_type: chunk.chunkType,
        source: chunk.source,
        source_run_id: sourceRunId,
        metadata: {},
        embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,content_hash,chunk_type,source' })

    if (insertErr) {
      console.log(`DB ERROR: ${insertErr.message}`)
      failed++
    } else {
      console.log('OK')
      stored++
    }
  }

  // 5. Set knowledge_backend = 'pgvector' ONLY if chunks were actually stored
  if (stored > 0) {
    await supabase
      .from('clients')
      .update({ knowledge_backend: 'pgvector' })
      .eq('id', client.id)
    console.log(`\nDone! stored=${stored} failed=${failed} runId=${sourceRunId}`)
    console.log(`knowledge_backend set to 'pgvector' for ${CLIENT_SLUG}`)
  } else {
    console.log(`\nDone! stored=${stored} failed=${failed} runId=${sourceRunId}`)
    console.log(`WARNING: No chunks stored — knowledge_backend NOT changed`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
