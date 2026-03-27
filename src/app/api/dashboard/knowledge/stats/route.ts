import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

/**
 * GET /api/dashboard/knowledge/stats?client_id=xxx
 * Returns chunk counts by status + type breakdown + source count vs plan limit.
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

  const svc = createServiceClient()

  // Parallel: chunks + source count + client plan + open gaps
  const [chunksResult, sourceCountResult, clientResult, gapsResult] = await Promise.all([
    svc.from('knowledge_chunks').select('status, chunk_type, source').eq('client_id', clientId),
    svc.from('client_knowledge_docs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    svc.from('clients').select('selected_plan, subscription_status').eq('id', clientId).single(),
    svc.from('knowledge_query_log').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('result_count', 0).is('resolved_at', null),
  ])

  if (chunksResult.error) return NextResponse.json({ error: chunksResult.error.message }, { status: 500 })

  const rows = chunksResult.data ?? []
  let approved = 0, pending = 0, rejected = 0
  const byType: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  for (const row of rows) {
    if (row.status === 'approved') approved++
    else if (row.status === 'pending') pending++
    else if (row.status === 'rejected') rejected++

    const t = row.chunk_type ?? 'unknown'
    byType[t] = (byType[t] ?? 0) + 1

    const s = row.source ?? 'unknown'
    bySource[s] = (bySource[s] ?? 0) + 1
  }

  // Derive plan source limits
  const sourceCount = sourceCountResult.count ?? 0
  let maxSources = 3
  if (clientResult.data) {
    const isTrialing = clientResult.data.subscription_status === 'trialing'
    const plan = getPlanEntitlements(isTrialing ? 'trial' : clientResult.data.selected_plan)
    maxSources = plan.maxKnowledgeSources
  }

  // G5: Knowledge coverage = approved / (approved + pending + open gaps)
  // This gives a truthful picture of how much of the agent's knowledge is live.
  const openGaps = gapsResult.count ?? 0
  const coverageDenominator = approved + pending + openGaps
  const coverage = coverageDenominator > 0
    ? Math.round((approved / coverageDenominator) * 100)
    : null // null = no knowledge added yet

  return NextResponse.json({
    total: rows.length,
    approved,
    pending,
    rejected,
    byType,
    bySource,
    sourceCount,
    maxSources,
    openGaps,
    coverage,
  })
}
