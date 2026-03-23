import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'

const SIMILARITY_FLOOR = 0.55

/**
 * POST /api/dashboard/knowledge/suggest
 *
 * Given a gap query, returns the single best-matching approved knowledge chunk.
 * Used for AI-suggested answers in the inline gap card editor.
 * Lightweight: returns top-1 only, no writes.
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

  const body = await req.json().catch(() => ({})) as { client_id?: string; query?: string }
  const query = body.query?.trim()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id

  const svc = createServiceClient()

  // Embed the gap query
  const embedding = await embedText(query)
  if (!embedding) {
    return NextResponse.json({ suggestion: null, reason: 'embedding_failed' })
  }

  // Hybrid search — top 1 only
  const { data: results, error: rpcErr } = await svc.rpc('hybrid_match_knowledge', {
    query_text: query,
    query_embedding: JSON.stringify(embedding),
    match_client_id: clientId,
    match_count: 1,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 50,
  })

  if (rpcErr) {
    return NextResponse.json({ suggestion: null, reason: 'search_failed' })
  }

  const matches = (results ?? []) as Array<{
    content: string
    chunk_type: string
    similarity: number
    status: string
    trust_tier: string
  }>

  // Only return approved chunks above similarity floor
  const best = matches.find(m => m.status === 'approved' && m.similarity >= SIMILARITY_FLOOR)

  if (!best) {
    return NextResponse.json({ suggestion: null })
  }

  return NextResponse.json({
    suggestion: {
      content: best.content,
      chunk_type: best.chunk_type,
      similarity: best.similarity,
      trust_tier: best.trust_tier,
    },
  })
}
