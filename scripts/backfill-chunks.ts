#!/usr/bin/env npx tsx
/**
 * backfill-chunks.ts — Import custom knowledge chunks into pgvector
 *
 * Usage:
 *   npx tsx scripts/backfill-chunks.ts --slug windshield-hub --file tests/retrieval-eval/chunks/windshield-hub-enrichment.json
 *   npx tsx scripts/backfill-chunks.ts --slug windshield-hub --file chunks.json --dry-run
 *   npx tsx scripts/backfill-chunks.ts --slug windshield-hub --file chunks.json --replace-source manual
 *
 * Env vars (reads from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service role key
 *   OPENROUTER_API_KEY          — For embedding via OpenRouter (or OPENAI_API_KEY)
 *
 * Input JSON format:
 *   [{ "content": "...", "chunk_type": "fact"|"qa", "source": "manual" }, ...]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import crypto from 'crypto'

// Load .env.local from project root
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

// Also load ~/.secrets style env
const secretsPath = path.join(process.env.HOME || '', '.secrets')
if (fs.existsSync(secretsPath)) {
  const content = fs.readFileSync(secretsPath, 'utf-8')
  for (const line of content.split('\n')) {
    const match = line.match(/^export\s+(\w+)=["']?(.+?)["']?\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const slug = getArg('--slug')
const filePath = getArg('--file')
const dryRun = hasFlag('--dry-run')
const replaceSource = getArg('--replace-source') // if set, deletes all chunks with this source before importing

if (!slug || !filePath) {
  console.error('Usage: npx tsx scripts/backfill-chunks.ts --slug <slug> --file <path.json> [--dry-run] [--replace-source <source>]')
  process.exit(1)
}

// ── Validate env ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!OPENAI_KEY && !OPENROUTER_KEY) {
  console.error('Missing OPENAI_API_KEY or OPENROUTER_API_KEY')
  process.exit(1)
}

const embeddingSource = OPENAI_KEY ? 'openai' : 'openrouter'
console.log(`Embedding source: ${embeddingSource}`)

// ── Supabase helpers ────────────────────────────────────────────────────────────

async function supabaseQuery(path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ── Embedding ───────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[] | null> {
  const start = Date.now()
  let url: string, headers: Record<string, string>, body: Record<string, unknown>

  if (OPENAI_KEY) {
    url = 'https://api.openai.com/v1/embeddings'
    headers = { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
    body = { model: 'text-embedding-3-small', input: text }
  } else {
    url = 'https://openrouter.ai/api/v1/embeddings'
    headers = { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' }
    body = { model: 'openai/text-embedding-3-small', input: text }
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.text().catch(() => '?')
      console.error(`  Embedding failed (${res.status}): ${err.slice(0, 200)}`)
      return null
    }
    const data = await res.json() as { data?: { embedding: number[] }[] }
    const embedding = data.data?.[0]?.embedding
    if (!embedding || embedding.length !== 1536) {
      console.error(`  Unexpected embedding dims: ${embedding?.length}`)
      return null
    }
    const latency = Date.now() - start
    process.stdout.write(` embed=${latency}ms`)
    return embedding
  } catch (err) {
    console.error(`  Embedding error:`, err)
    return null
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

type ChunkInput = {
  content: string
  chunk_type: string
  source: string
  metadata?: Record<string, unknown>
}

async function main() {
  // Load chunks
  const absPath = path.resolve(filePath!)
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`)
    process.exit(1)
  }
  const chunks: ChunkInput[] = JSON.parse(fs.readFileSync(absPath, 'utf-8'))
  console.log(`Loaded ${chunks.length} chunks from ${absPath}`)

  // Look up client
  const clients = await supabaseQuery(
    `clients?slug=eq.${slug}&select=id,slug,knowledge_backend`,
    'GET',
  ) as { id: string; slug: string; knowledge_backend: string | null }[]

  if (!clients || clients.length === 0) {
    console.error(`Client not found: ${slug}`)
    process.exit(1)
  }
  const client = clients[0]
  console.log(`Client: ${client.slug} (${client.id}) knowledge_backend=${client.knowledge_backend}`)

  if (dryRun) {
    console.log('\n=== DRY RUN — would import these chunks: ===')
    chunks.forEach((c, i) => {
      console.log(`  [${i + 1}] (${c.chunk_type}) ${c.content.slice(0, 100)}...`)
    })
    console.log(`\nTotal: ${chunks.length} chunks. Run without --dry-run to import.`)
    return
  }

  // Delete old chunks for this source if --replace-source
  if (replaceSource) {
    console.log(`Deleting existing chunks with source="${replaceSource}"...`)
    await supabaseQuery(
      `knowledge_chunks?client_id=eq.${client.id}&source=eq.${replaceSource}`,
      'DELETE',
    )
    console.log('  Deleted.')
  }

  // Embed and insert
  const sourceRunId = crypto.randomUUID()
  let stored = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    process.stdout.write(`  [${i + 1}/${chunks.length}] (${chunk.chunk_type}) "${chunk.content.slice(0, 50)}..."`)

    const embedding = await embedText(chunk.content)
    if (!embedding) {
      failed++
      console.log(' FAILED')
      continue
    }

    try {
      await supabaseQuery('knowledge_chunks', 'POST', {
        client_id: client.id,
        content: chunk.content,
        chunk_type: chunk.chunk_type,
        source: chunk.source,
        source_run_id: sourceRunId,
        metadata: chunk.metadata ?? {},
        embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString(),
      })
      stored++
      console.log(' OK')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('duplicate') || msg.includes('23505')) {
        skipped++
        console.log(' SKIP (duplicate)')
      } else {
        failed++
        console.log(` ERROR: ${msg.slice(0, 100)}`)
      }
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`  Stored: ${stored}`)
  console.log(`  Skipped (duplicate): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Source run ID: ${sourceRunId}`)

  // Set knowledge_backend if not already pgvector
  if (client.knowledge_backend !== 'pgvector') {
    console.log(`\nSetting knowledge_backend='pgvector' for ${slug}...`)
    await supabaseQuery(
      `clients?id=eq.${client.id}`,
      'PATCH',
      { knowledge_backend: 'pgvector' },
    )
    console.log('  Done.')
  }

  const evalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  console.log(`\nNext: run eval to measure impact:`)
  console.log(`  source ~/.secrets && cd "/Users/owner/Downloads/CALLING AGENTs" && EVAL_BASE_URL=${evalUrl} npx tsx tests/retrieval-eval/run-eval.ts --slug ${slug} --verbose`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(2)
})
