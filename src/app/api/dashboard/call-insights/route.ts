/**
 * GET /api/dashboard/call-insights
 *
 * Returns per-call transcript analysis results from the call_insights table.
 * Auth: Supabase session + client_users gating (multi-tenant safe).
 *
 * Query params:
 * - call_id: (optional) filter to a specific call — returns single insight
 * - client_id: (optional, admin only) override client
 * - limit: (optional) max results, default 20, max 50
 * - days: (optional) only insights from last N days, default 30, max 90
 *
 * ## How to edit
 * - Add filters: extend the query builder before .order()
 * - Add aggregation: create a separate /call-insights/aggregate endpoint
 * - Change auth: this follows the same pattern as all dashboard routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const callId = params.get('call_id')

  // Single call lookup
  if (callId) {
    const { data, error } = await supabase
      .from('call_insights')
      .select('*')
      .eq('client_id', clientId)
      .eq('call_id', callId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insight: data })
  }

  // List with pagination
  const limit = Math.min(parseInt(params.get('limit') || '20'), 50)
  const days = Math.min(parseInt(params.get('days') || '30'), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('call_insights')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ insights: data, total: data?.length ?? 0, days })
}
