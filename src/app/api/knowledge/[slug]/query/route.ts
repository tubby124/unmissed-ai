import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'

const MATCH_THRESHOLD = 0.72
const MATCH_COUNT = 5

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const start = Date.now()

  // ── Auth — X-Tool-Secret (same pattern as transfer/sms tools) ──────────────
  const toolSecret = process.env.WEBHOOK_SIGNING_SECRET
  const providedSecret = req.headers.get('X-Tool-Secret')
  if (toolSecret && providedSecret !== toolSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { query?: string }
  const queryText = body.query?.trim()
  if (!queryText) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }

  // ── Look up client ─────────────────────────────────────────────────────────
  const supabase = createServiceClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, knowledge_backend')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (client.knowledge_backend !== 'pgvector') {
    return NextResponse.json({ error: 'pgvector not enabled for this client' }, { status: 400 })
  }

  // ── Embed query ────────────────────────────────────────────────────────────
  const embedding = await embedText(queryText)
  if (!embedding) {
    const latency = Date.now() - start
    // Log failed query
    await logQuery(supabase, client.id, slug, queryText, 0, null, MATCH_THRESHOLD, latency)
    console.log(`[knowledge-query] slug=${slug} EMBEDDING_FAILED query="${queryText.slice(0, 80)}" latency=${latency}ms`)
    return NextResponse.json({ results: [], count: 0, error: 'embedding_failed' })
  }

  // ── Similarity search via match_knowledge RPC ──────────────────────────────
  const { data: results, error: rpcErr } = await supabase.rpc('match_knowledge', {
    query_embedding: JSON.stringify(embedding),
    match_client_id: client.id,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
  })

  const latency = Date.now() - start
  const matches = (results ?? []) as Array<{
    id: string
    content: string
    chunk_type: string
    source: string
    source_run_id: string | null
    metadata: Record<string, unknown>
    similarity: number
  }>

  if (rpcErr) {
    console.error(`[knowledge-query] slug=${slug} RPC error: ${rpcErr.message}`)
    await logQuery(supabase, client.id, slug, queryText, 0, null, MATCH_THRESHOLD, latency)
    return NextResponse.json({ results: [], count: 0, error: 'search_failed' })
  }

  const topSimilarity = matches.length > 0 ? matches[0].similarity : null

  // ── Log query for observability ────────────────────────────────────────────
  const queryLogId = await logQuery(
    supabase, client.id, slug, queryText,
    matches.length, topSimilarity, MATCH_THRESHOLD, latency,
  )

  if (matches.length === 0) {
    console.log(`[knowledge-query] slug=${slug} EMPTY_RESULT query="${queryText.slice(0, 80)}" threshold=${MATCH_THRESHOLD} latency=${latency}ms`)
  } else {
    console.log(`[knowledge-query] slug=${slug} query="${queryText.slice(0, 80)}" results=${matches.length} top=${topSimilarity?.toFixed(3)} latency=${latency}ms`)
  }

  return NextResponse.json({
    results: matches.map(m => ({
      content: m.content,
      chunk_type: m.chunk_type,
      source: m.source,
      similarity: m.similarity,
      source_run_id: m.source_run_id,
    })),
    count: matches.length,
    query_id: queryLogId,
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function logQuery(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  slug: string,
  queryText: string,
  resultCount: number,
  topSimilarity: number | null,
  threshold: number,
  latencyMs: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('knowledge_query_log')
    .insert({
      client_id: clientId,
      slug,
      query_text: queryText,
      result_count: resultCount,
      top_similarity: topSimilarity,
      threshold_used: threshold,
      latency_ms: latencyMs,
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[knowledge-query] Log insert failed: ${error.message}`)
    return null
  }
  return data?.id ?? null
}
