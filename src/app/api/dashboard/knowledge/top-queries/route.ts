import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/knowledge/top-queries?client_id=xxx
 *
 * Returns the top 10 most frequent query_text values from knowledge_query_log
 * for the authenticated client. Includes all queries regardless of result_count
 * so owners can see what callers search for most — not just failed searches.
 *
 * Response: { queries: Array<{ query: string, count: number }> }
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id

  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const svc = createServiceClient()

  // Fetch recent query log entries (last 90 days, cap at 1000 for grouping)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await svc
    .from('knowledge_query_log')
    .select('query_text')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .limit(1000)
    .abortSignal(AbortSignal.timeout(10000))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ queries: [] })

  // Group by normalized query text, count frequency
  const counts = new Map<string, { query: string; count: number }>()
  for (const row of rows) {
    const normalized = row.query_text.toLowerCase().trim().replace(/\s+/g, ' ')
    const existing = counts.get(normalized)
    if (existing) {
      existing.count++
    } else {
      counts.set(normalized, { query: row.query_text, count: 1 })
    }
  }

  // Sort by frequency desc, return top 10
  const queries = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({ queries })
}
