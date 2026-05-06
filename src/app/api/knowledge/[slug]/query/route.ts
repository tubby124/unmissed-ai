import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { parseCallState, setStateUpdate, knowledgeInstruction, readCallStateFromDb, persistCallStateToDb } from '@/lib/call-state'
import { recordToolInvocation } from '@/lib/tool-invocations'

const MATCH_COUNT = 5
const RRF_MIN_SCORE = 0.005 // Minimum RRF score to return (filters out noise)
const SIMILARITY_FLOOR = 0.45 // Results without a keyword match must exceed this cosine similarity. Loosened 2026-04-25 from 0.60 — limited call data + middle-tier clients with rich website knowledge were getting empty results when caller phrasing didn't share keywords with chunks (e.g. "rent guarantee program" vs chunk "rent guarantee, tenant screening...").

// Trust tier sort order — high-trust chunks surface first at equal RRF scores
const TRUST_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

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

  // B3: Read call state — header first (createCall), DB fallback (Agents API lacks initialState)
  let callState = parseCallState(req)
  console.log(`[knowledge] B3 call-state header: ${callState ? 'PRESENT' : 'NULL'}`)

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { query?: string; call_id?: string }
  const callId = body.call_id
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

  // DB fallback: Agents API doesn't inject X-Call-State (no initialState support)
  if (!callState && callId) callState = await readCallStateFromDb(supabase, callId)

  // Resolve call_log_id from ultravox_call_id (non-blocking lookup) — same pattern as
  // calendar/book and webhook/maintenance-request. Without this, every queryKnowledge fire
  // logs to tool_invocations with NULL call_log_id and per-call analytics break.
  let callLogId: string | null = null
  if (callId) {
    const { data: log } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', callId)
      .limit(1)
      .maybeSingle()
    callLogId = (log?.id as string | undefined) ?? null
  }

  if (client.knowledge_backend !== 'pgvector') {
    return NextResponse.json({ error: 'pgvector not enabled for this client' }, { status: 400 })
  }

  // ── Embed query ────────────────────────────────────────────────────────────
  const embedding = await embedText(queryText)
  if (!embedding) {
    const latency = Date.now() - start
    await logQuery(supabase, client.id, slug, queryText, 0, null, 0, latency)
    console.log(`[knowledge-query] slug=${slug} EMBEDDING_FAILED query="${queryText.slice(0, 80)}" latency=${latency}ms`)
    void recordToolInvocation({
      clientId: client.id, callLogId, toolName: 'queryKnowledge',
      queryText, chunkIdsHit: null, success: false, latencyMs: latency,
    })
    return NextResponse.json({ results: [], count: 0, error: 'embedding_failed' })
  }

  // ── Hybrid search via RRF (pgvector cosine + tsvector keyword) ─────────────
  const { data: results, error: rpcErr } = await supabase.rpc('hybrid_match_knowledge', {
    query_text: queryText,
    query_embedding: JSON.stringify(embedding),
    match_client_id: client.id,
    match_count: MATCH_COUNT,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 50,
  })

  const latency = Date.now() - start
  const rawMatches = (results ?? []) as Array<{
    id: string
    content: string
    chunk_type: string
    source: string
    source_run_id: string | null
    metadata: Record<string, unknown>
    similarity: number
    keyword_rank: number | null
    semantic_rank: number | null
    rrf_score: number
    status: string
    trust_tier: string
  }>

  if (rpcErr) {
    console.error(`[knowledge-query] slug=${slug} RPC error: ${rpcErr.message}`)
    await logQuery(supabase, client.id, slug, queryText, 0, null, 0, latency, embedding)
    void recordToolInvocation({
      clientId: client.id, callLogId, toolName: 'queryKnowledge',
      queryText, chunkIdsHit: null, success: false, latencyMs: latency,
    })
    return NextResponse.json({ results: [], count: 0, error: 'search_failed' })
  }

  // Filter: keep results that have a keyword match OR good cosine similarity
  // This ensures out-of-scope queries stay empty while keyword-matched relevant results get through
  const relevantMatches = rawMatches.filter(m => {
    const hasKeyword = m.keyword_rank !== null
    const hasGoodSimilarity = m.similarity >= SIMILARITY_FLOOR
    return (hasKeyword || hasGoodSimilarity) && m.rrf_score >= RRF_MIN_SCORE
  })

  // ── Governance: only return approved chunks ──────────────────────────────
  const approvedMatches = relevantMatches.filter(m => m.status === 'approved')

  // ── Sort by RRF score (primary) then trust tier (secondary tiebreaker) ───
  const sorted = approvedMatches.sort((a, b) => {
    const scoreDiff = b.rrf_score - a.rrf_score
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff
    const tierA = TRUST_ORDER[a.trust_tier] ?? 1
    const tierB = TRUST_ORDER[b.trust_tier] ?? 1
    return tierA - tierB
  })

  const topSimilarity = sorted.length > 0 ? sorted[0].similarity : null

  // ── Log query for observability ────────────────────────────────────────────
  const queryLogId = await logQuery(
    supabase, client.id, slug, queryText,
    sorted.length, topSimilarity, RRF_MIN_SCORE, latency,
    embedding,
  )

  // K8: Increment hit_count for matched chunks
  if (sorted.length > 0) {
    const matchedIds = sorted.map(m => m.id)
    try {
      const { error: hitErr } = await supabase.rpc('increment_chunk_hits', { chunk_ids: matchedIds })
      if (hitErr) console.error(`[knowledge-query] hit tracking failed: ${hitErr.message}`)
    } catch (e) {
      console.error('[knowledge-query] hit tracking threw:', e)
    }
  }

  // Preemptive resolve: if zero results but an approved chunk covers this at 0.90+, auto-resolve the gap
  if (sorted.length === 0 && queryLogId && embedding) {
    try {
      const { data: resolved } = await supabase.rpc('try_preemptive_gap_resolve', {
        p_query_log_id: queryLogId,
        p_client_id: client.id,
        p_query_embedding: JSON.stringify(embedding),
        p_similarity_threshold: 0.90,
      })
      if (resolved) {
        console.log(`[knowledge-query] slug=${slug} PREEMPTIVE_RESOLVE query="${queryText.slice(0, 60)}" — approved chunk covers this gap`)
      }
    } catch (e) {
      console.error('[knowledge-query] preemptive resolve failed (non-fatal):', e)
    }
  }

  if (sorted.length === 0) {
    console.log(`[knowledge-query] slug=${slug} EMPTY_RESULT query="${queryText.slice(0, 80)}" rrf_min=${RRF_MIN_SCORE} latency=${latency}ms`)
  } else {
    for (const m of sorted) {
      console.log(`[knowledge-query] slug=${slug} "${m.content.slice(0, 50)}" rrf=${m.rrf_score.toFixed(4)} kw=${m.keyword_rank ?? '-'} sem=${m.semantic_rank ?? '-'} sim=${m.similarity.toFixed(3)} tier=${m.trust_tier}`)
    }
    console.log(`[knowledge-query] slug=${slug} query="${queryText.slice(0, 60)}" results=${sorted.length} top_rrf=${sorted[0].rrf_score.toFixed(4)} top_sim=${topSimilarity?.toFixed(3)} top_tier=${sorted[0].trust_tier} latency=${latency}ms`)
  }

  // ── Build response with trust-aware _instruction + B3 state coaching ──────
  const topContent = sorted[0]?.content?.slice(0, 200) || ''
  const topTrust = sorted[0]?.trust_tier || 'medium'
  const trustQualifier = topTrust === 'high' ? '' : topTrust === 'low' ? ' This information has not been fully verified — be cautious.' : ''
  const found = sorted.length > 0
  const newQueries = (callState?.knowledgeQueries ?? 0) + 1
  const coaching = callState ? knowledgeInstruction({ ...callState, knowledgeQueries: newQueries }, found) : ''

  const baseInstruction = found
    ? `Found: ${topContent}. Read this back naturally — do not say 'according to our knowledge base' or 'our records show'.${trustQualifier}`
    : `No information found. Say you're not sure about that specific question and offer to have someone follow up.`

  const response = NextResponse.json({
    results: sorted.map(m => ({
      content: m.content,
      chunk_type: m.chunk_type,
      source: m.source,
      similarity: m.similarity,
      source_run_id: m.source_run_id,
      rrf_score: m.rrf_score,
      trust_tier: m.trust_tier,
    })),
    count: sorted.length,
    query_id: queryLogId,
    _instruction: coaching ? `${baseInstruction} ${coaching}` : baseInstruction,
  })
  const stateUpdates = { knowledgeQueries: newQueries, lastToolOutcome: found ? 'knowledge_found' as const : 'knowledge_empty' as const }
  if (callState) setStateUpdate(response, stateUpdates)
  if (callId) await persistCallStateToDb(supabase, callId, callState, stateUpdates)
  void recordToolInvocation({
    clientId: client.id, callLogId, toolName: 'queryKnowledge',
    queryText, chunkIdsHit: sorted.map(m => m.id),
    success: true, latencyMs: Date.now() - start,
  })
  return response
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
  queryEmbedding?: number[] | null,
): Promise<string | null> {
  const row: Record<string, unknown> = {
    client_id: clientId,
    slug,
    query_text: queryText,
    result_count: resultCount,
    top_similarity: topSimilarity,
    threshold_used: threshold,
    latency_ms: latencyMs,
  }
  // Store embedding for zero-result queries (gaps) — enables auto-cascade resolution
  if (resultCount === 0 && queryEmbedding) {
    row.query_embedding = JSON.stringify(queryEmbedding)
  }
  const { data, error } = await supabase
    .from('knowledge_query_log')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error(`[knowledge-query] Log insert failed: ${error.message}`)
    return null
  }
  return data?.id ?? null
}
