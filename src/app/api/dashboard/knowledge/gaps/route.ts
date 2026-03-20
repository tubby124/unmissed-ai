import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/knowledge/gaps
 *
 * Returns unanswered caller questions from the knowledge_query_log.
 * Groups queries with result_count=0 by similarity, shows frequency.
 * This is the "call-learning pipeline" — surfaces what callers asked
 * but the knowledge base couldn't answer.
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

  // Get all empty-result queries in the time window
  const { data: emptyQueries, error } = await svc
    .from('knowledge_query_log')
    .select('query_text, created_at')
    .eq('client_id', clientId)
    .eq('result_count', 0)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!emptyQueries?.length) {
    return NextResponse.json({ gaps: [], total: 0, days })
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
