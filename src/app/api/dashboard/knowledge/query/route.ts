import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'

const MATCH_COUNT = 5
const RRF_MIN_SCORE = 0.005
const SIMILARITY_FLOOR = 0.60

/**
 * Dashboard-facing pgvector test query endpoint.
 * Authenticated via session (admin or owner of the client).
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()
  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({})) as { query?: string; client_id?: string }
  const queryText = body.query?.trim()
  if (!queryText) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }

  // Admin can query any client; owners query their own
  const targetClientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id

  const svc = createServiceClient()

  // Verify client exists and has pgvector enabled
  const { data: client } = await svc
    .from('clients')
    .select('id, knowledge_backend')
    .eq('id', targetClientId)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  if (client.knowledge_backend !== 'pgvector') {
    return NextResponse.json({ error: 'Knowledge base not enabled for this client' }, { status: 400 })
  }

  // Embed the query
  const embedding = await embedText(queryText)
  if (!embedding) {
    return NextResponse.json({ results: [], count: 0, error: 'embedding_failed' })
  }

  // Hybrid search via RRF
  const { data: results, error: rpcErr } = await svc.rpc('hybrid_match_knowledge', {
    query_text: queryText,
    query_embedding: JSON.stringify(embedding),
    match_client_id: targetClientId,
    match_count: MATCH_COUNT,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 50,
  })

  if (rpcErr) {
    return NextResponse.json({ results: [], count: 0, error: 'search_failed' })
  }

  const rawMatches = (results ?? []) as Array<{
    id: string
    content: string
    chunk_type: string
    source: string
    similarity: number
    keyword_rank: number | null
    rrf_score: number
    status: string
    trust_tier: string
  }>

  // Filter: keyword match OR good cosine similarity
  const relevant = rawMatches.filter(m => {
    const hasKeyword = m.keyword_rank !== null
    const hasGoodSimilarity = m.similarity >= SIMILARITY_FLOOR
    return (hasKeyword || hasGoodSimilarity) && m.rrf_score >= RRF_MIN_SCORE
  })

  // Only return approved chunks
  const approved = relevant.filter(m => m.status === 'approved')

  return NextResponse.json({
    results: approved.map(m => ({
      content: m.content,
      chunk_type: m.chunk_type,
      source: m.source,
      similarity: m.similarity,
      rrf_score: m.rrf_score,
      trust_tier: m.trust_tier,
    })),
    count: approved.length,
  })
}
