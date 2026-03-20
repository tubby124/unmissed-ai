import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/knowledge/stats?client_id=xxx
 * Returns chunk counts by status + type breakdown in a single query.
 * Replaces the 4 sequential fetches KnowledgeEngineCard was making.
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

  const svc = createServiceClient()

  // Single query: get all chunks with just the fields needed for counting
  const { data: chunks, error } = await svc
    .from('knowledge_chunks')
    .select('status, chunk_type')
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = chunks ?? []
  let approved = 0, pending = 0, rejected = 0
  const byType: Record<string, number> = {}

  for (const row of rows) {
    if (row.status === 'approved') approved++
    else if (row.status === 'pending') pending++
    else if (row.status === 'rejected') rejected++

    const t = row.chunk_type ?? 'unknown'
    byType[t] = (byType[t] ?? 0) + 1
  }

  return NextResponse.json({
    total: rows.length,
    approved,
    pending,
    rejected,
    byType,
  })
}
