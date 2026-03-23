import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/knowledge/gaps
 *
 * Returns unanswered caller questions from the knowledge_query_log.
 * Groups queries with result_count=0 by similarity, shows frequency.
 * Excludes resolved gaps (resolved_at IS NOT NULL).
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id
  const days = Math.min(parseInt(params.get('days') ?? '30', 10), 90)

  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const svc = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get all unresolved empty-result queries in the time window
  const { data: emptyQueries, error } = await svc
    .from('knowledge_query_log')
    .select('query_text, created_at')
    .eq('client_id', clientId)
    .eq('result_count', 0)
    .is('resolved_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!emptyQueries?.length) {
    return NextResponse.json({ gaps: [], total: 0, total_unanswered_queries: 0, days })
  }

  // Group similar queries (normalize: lowercase, trim, collapse whitespace)
  const groups = new Map<string, { query: string; count: number; first_seen: string; last_seen: string }>()
  for (const q of emptyQueries) {
    const normalized = q.query_text.toLowerCase().trim().replace(/\s+/g, ' ')
    const existing = groups.get(normalized)
    if (existing) {
      existing.count++
      if (q.created_at < existing.first_seen) existing.first_seen = q.created_at
      if (q.created_at > existing.last_seen) existing.last_seen = q.created_at
    } else {
      groups.set(normalized, {
        query: q.query_text,
        count: 1,
        first_seen: q.created_at,
        last_seen: q.created_at,
      })
    }
  }

  // Sort by frequency (most asked first), then by recency
  const gaps = Array.from(groups.values())
    .sort((a, b) => b.count - a.count || new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    .slice(0, 50)

  return NextResponse.json({
    gaps,
    total: gaps.length,
    total_unanswered_queries: emptyQueries.length,
    days,
  })
}

/**
 * POST /api/dashboard/knowledge/gaps
 *
 * Inserts unanswered questions detected from test call transcripts.
 * Body: { client_id?, questions: string[] }
 * Deduplicates against existing unresolved rows for the same client.
 * Source: 'transcript' (vs 'rag' for RAG misses).
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

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    questions?: string[]
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  const questions = body.questions

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'questions array is required' }, { status: 400 })
  }

  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const svc = createServiceClient()

  // Fetch existing unresolved queries for dedup
  const { data: existing } = await svc
    .from('knowledge_query_log')
    .select('query_text')
    .eq('client_id', clientId)
    .eq('result_count', 0)
    .is('resolved_at', null)
    .limit(500)

  const existingNormalized = new Set(
    (existing ?? []).map(r => r.query_text.toLowerCase().trim().replace(/\s+/g, ' '))
  )

  // Filter out duplicates and insert new gaps
  const newQuestions = questions
    .map(q => q.trim())
    .filter(q => q.length > 5)
    .filter(q => !existingNormalized.has(q.toLowerCase().trim().replace(/\s+/g, ' ')))
    .slice(0, 10) // cap at 10 per call

  if (newQuestions.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const rows = newQuestions.map(q => ({
    client_id: clientId,
    query_text: q,
    result_count: 0,
    source: 'transcript',
  }))

  const { error } = await svc.from('knowledge_query_log').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: rows.length })
}

/**
 * PATCH /api/dashboard/knowledge/gaps
 *
 * Resolves a gap by marking all matching query_log rows as resolved.
 * Body: { client_id?, query: string, resolution_type: 'faq' | 'knowledge' | 'dismissed' }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    query?: string
    resolution_type?: string
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  const query = body.query?.trim()
  const resolutionType = body.resolution_type

  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })
  if (!resolutionType || !['faq', 'knowledge', 'dismissed'].includes(resolutionType)) {
    return NextResponse.json({ error: 'resolution_type must be "faq", "knowledge", or "dismissed"' }, { status: 400 })
  }

  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const svc = createServiceClient()
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ')

  // Mark all matching unresolved rows as resolved
  const { count, error } = await svc
    .from('knowledge_query_log')
    .update({
      resolved_at: new Date().toISOString(),
      resolution_type: resolutionType,
    })
    .eq('client_id', clientId)
    .eq('result_count', 0)
    .is('resolved_at', null)
    .ilike('query_text', normalized)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, resolved_count: count ?? 0 })
}
