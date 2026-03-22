/**
 * embeddings.ts — pgvector embedding pipeline for knowledge chunks
 *
 * Uses OpenAI text-embedding-3-small directly (fewer hops than OpenRouter).
 * Fallback: OPENROUTER_API_KEY with openai/text-embedding-3-small model.
 *
 * Env vars: OPENAI_API_KEY (preferred) or OPENROUTER_API_KEY (fallback)
 */

import { createServiceClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ChunkInput = {
  content: string
  chunkType: 'fact' | 'qa' | 'page_content' | 'manual' | 'niche_template' | 'call_learning'
  source: string
  metadata?: Record<string, unknown>
  /** Optional chunk status (e.g. 'pending', 'approved'). If omitted, DB default applies. */
  status?: string
  /** Optional trust tier (e.g. 'low', 'medium', 'high'). If omitted, DB default applies. */
  trustTier?: string
}

export type EmbedResult = {
  stored: number
  failed: number
  errors: string[]
}

// ── Embedding ──────────────────────────────────────────────────────────────────

/**
 * Embed a single text string. Returns 1536-dim array or null on failure.
 * Prefers OPENAI_API_KEY direct; falls back to OPENROUTER_API_KEY.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const start = Date.now()
  const openaiKey = process.env.OPENAI_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  let url: string
  let headers: Record<string, string>
  let body: Record<string, unknown>
  let source: string

  if (openaiKey) {
    url = 'https://api.openai.com/v1/embeddings'
    headers = { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }
    body = { model: 'text-embedding-3-small', input: text }
    source = 'openai-direct'
  } else if (openrouterKey) {
    url = 'https://openrouter.ai/api/v1/embeddings'
    headers = { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' }
    body = { model: 'openai/text-embedding-3-small', input: text }
    source = 'openrouter'
  } else {
    console.error('[embeddings] No OPENAI_API_KEY or OPENROUTER_API_KEY set')
    return null
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '(unreadable)')
      console.error(`[embeddings] ${source} HTTP ${res.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const embedding: number[] = data.data?.[0]?.embedding
    const tokens = data.usage?.total_tokens ?? 0
    const latency = Date.now() - start

    if (!embedding || embedding.length !== 1536) {
      console.error(`[embeddings] Unexpected embedding dimension: ${embedding?.length}`)
      return null
    }

    console.log(`[embeddings] model=text-embedding-3-small source=${source} tokens=${tokens} latency=${latency}ms`)
    return embedding
  } catch (err) {
    console.error(`[embeddings] ${source} fetch error:`, err)
    return null
  }
}

/**
 * Embed and store multiple chunks for a client.
 * Uses ON CONFLICT to upsert (dedup by client_id + content_hash + chunk_type + source).
 */
export async function embedChunks(
  clientId: string,
  chunks: ChunkInput[],
  sourceRunId: string,
): Promise<EmbedResult> {
  const supabase = createServiceClient()
  let stored = 0
  let failed = 0
  const errors: string[] = []

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.content)
    if (!embedding) {
      failed++
      errors.push(`Failed to embed: ${chunk.content.slice(0, 60)}...`)
      continue
    }

    const row: Record<string, unknown> = {
      client_id: clientId,
      content: chunk.content,
      chunk_type: chunk.chunkType,
      source: chunk.source,
      source_run_id: sourceRunId,
      metadata: chunk.metadata ?? {},
      embedding: JSON.stringify(embedding),
      updated_at: new Date().toISOString(),
    }
    if (chunk.status) row.status = chunk.status
    if (chunk.trustTier) row.trust_tier = chunk.trustTier

    const { error } = await supabase
      .from('knowledge_chunks')
      .upsert(row, { onConflict: 'client_id,content_hash,chunk_type,source' })

    if (error) {
      failed++
      errors.push(`DB error: ${error.message}`)
    } else {
      stored++
    }
  }

  console.log(`[embeddings] embedChunks: stored=${stored} failed=${failed} clientId=${clientId} runId=${sourceRunId}`)
  return { stored, failed, errors }
}

/**
 * Delete chunks for a client, optionally filtered by source.
 */
export async function deleteClientChunks(clientId: string, source?: string): Promise<number> {
  const supabase = createServiceClient()
  let query = supabase
    .from('knowledge_chunks')
    .delete()
    .eq('client_id', clientId)

  if (source) query = query.eq('source', source)

  const { data, error } = await query.select('id')
  if (error) {
    throw new Error(`deleteClientChunks failed for client=${clientId} source=${source ?? 'all'}: ${error.message}`)
  }
  const count = data?.length ?? 0
  console.log(`[embeddings] deleteClientChunks: clientId=${clientId} source=${source ?? 'all'} deleted=${count}`)
  return count
}

// ── Chunk preparers ────────────────────────────────────────────────────────────

/**
 * Convert business_facts text into ChunkInputs (one per non-empty line).
 * @param source — chunk source tag. 'website_scrape' for scrape-derived, 'settings_edit' for dashboard edits.
 */
export function prepareFactChunks(businessFacts: string | null, source: string = 'website_scrape'): ChunkInput[] {
  if (!businessFacts) return []
  return businessFacts
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('---'))
    .map(line => ({
      content: line,
      chunkType: 'fact' as const,
      source,
    }))
}

/**
 * Convert extra_qa pairs into ChunkInputs (one per Q&A pair).
 * @param source — chunk source tag. 'website_scrape' for scrape-derived, 'settings_edit' for dashboard edits.
 */
export function prepareQaChunks(extraQa: { q: string; a: string }[], source: string = 'website_scrape'): ChunkInput[] {
  return extraQa
    .filter(pair => pair.q?.trim() && pair.a?.trim())
    .map(pair => ({
      content: `Q: ${pair.q.trim()}\nA: ${pair.a.trim()}`,
      chunkType: 'qa' as const,
      source,
    }))
}

/**
 * Convert service tags into a single ChunkInput.
 * Seeds: "Services offered: tag1, tag2, tag3"
 */
export function prepareServiceTagChunks(serviceTags: string[]): ChunkInput[] {
  const tags = serviceTags.filter(t => t?.trim())
  if (tags.length === 0) return []
  return [{
    content: `Services offered: ${tags.join(', ')}`,
    chunkType: 'fact' as const,
    source: 'website_scrape',
  }]
}

// ── Settings-edit knowledge reseed ─────────────────────────────────────────
/**
 * Reseed knowledge chunks from business_facts + extra_qa after a settings edit.
 * Replaces only 'settings_edit' source chunks — preserves website_scrape, manual, etc.
 * Fire-and-forget safe: logs errors but does not throw.
 */
export async function reseedKnowledgeFromSettings(
  clientId: string,
  businessFacts: string | null,
  extraQa: { q: string; a: string }[],
): Promise<{ stored: number; failed: number }> {
  try {
    const chunks = [
      ...prepareFactChunks(businessFacts, 'settings_edit'),
      ...prepareQaChunks(extraQa, 'settings_edit'),
    ]

    // Clear old settings_edit chunks (does NOT touch website_scrape or manual chunks)
    await deleteClientChunks(clientId, 'settings_edit')

    if (chunks.length === 0) {
      return { stored: 0, failed: 0 }
    }

    // Mark as approved + high trust (user explicitly wrote these)
    for (const chunk of chunks) {
      chunk.status = 'approved'
      chunk.trustTier = 'high'
    }

    const result = await embedChunks(clientId, chunks, `settings-edit-${Date.now()}`)
    console.log(`[embeddings] reseedKnowledgeFromSettings: clientId=${clientId} stored=${result.stored} failed=${result.failed}`)
    return { stored: result.stored, failed: result.failed }
  } catch (err) {
    console.error(`[embeddings] reseedKnowledgeFromSettings failed for clientId=${clientId}:`, err)
    return { stored: 0, failed: 0 }
  }
}
