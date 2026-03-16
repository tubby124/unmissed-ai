import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth: admin only
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const service = createServiceClient()

  // Fetch all demo calls (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: demoCalls, error } = await service
    .from('demo_calls')
    .select('*')
    .gte('started_at', thirtyDaysAgo)
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[demo-stats] Query failed:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const calls = demoCalls ?? []
  const today = new Date().toISOString().slice(0, 10)

  // Compute stats
  const totalDemos = calls.length
  const todayDemos = calls.filter(c => c.started_at?.slice(0, 10) === today).length
  const converted = calls.filter(c => c.converted).length
  const conversionRate = totalDemos > 0 ? Math.round((converted / totalDemos) * 100) : 0

  // Most popular agent
  const agentCounts: Record<string, number> = {}
  for (const c of calls) {
    agentCounts[c.demo_id] = (agentCounts[c.demo_id] || 0) + 1
  }
  const popularAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Avg duration (only completed calls)
  const completedCalls = calls.filter(c => c.duration_seconds && c.duration_seconds > 0)
  const avgDuration = completedCalls.length > 0
    ? Math.round(completedCalls.reduce((sum, c) => sum + c.duration_seconds, 0) / completedCalls.length)
    : 0

  // Source breakdown
  const browserCount = calls.filter(c => c.source === 'browser').length
  const phoneCount = calls.filter(c => c.source === 'phone').length

  // Per-agent breakdown
  const agentBreakdown: Record<string, { calls: number; avgDuration: number; converted: number }> = {}
  for (const [agentId, count] of Object.entries(agentCounts)) {
    const agentCalls = calls.filter(c => c.demo_id === agentId)
    const agentCompleted = agentCalls.filter(c => c.duration_seconds && c.duration_seconds > 0)
    const agentAvgDur = agentCompleted.length > 0
      ? Math.round(agentCompleted.reduce((sum: number, c: { duration_seconds: number }) => sum + c.duration_seconds, 0) / agentCompleted.length)
      : 0
    agentBreakdown[agentId] = {
      calls: count,
      avgDuration: agentAvgDur,
      converted: agentCalls.filter(c => c.converted).length,
    }
  }

  return NextResponse.json({
    stats: {
      totalDemos,
      todayDemos,
      converted,
      conversionRate,
      popularAgent,
      avgDuration,
      browserCount,
      phoneCount,
      agentBreakdown,
    },
    recentCalls: calls.slice(0, 50).map(c => ({
      id: c.id,
      demoId: c.demo_id,
      callerName: c.caller_name,
      source: c.source,
      durationSeconds: c.duration_seconds,
      converted: c.converted,
      startedAt: c.started_at,
    })),
  })
}
