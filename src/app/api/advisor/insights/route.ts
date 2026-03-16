import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  computeTrends,
  findFollowUpGaps,
  generateInsightCards,
  type CallRow,
} from '@/lib/advisor-data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find client_id
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!cu?.client_id) {
    return NextResponse.json({ cards: [], trends: null, gaps: [] })
  }

  // Fetch all calls for the last 30 days (enough for trends + gaps)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: calls, error: callErr } = await supabase
    .from('call_logs')
    .select('id, call_status, duration_seconds, created_at, sentiment, quality_score, key_topics, next_steps, ai_summary, caller_phone, service_type')
    .eq('client_id', cu.client_id)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (callErr) {
    console.error('[advisor] insights: call_logs query failed:', callErr.message)
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
  }

  const callRows: CallRow[] = (calls || []).map(c => ({
    ...c,
    transcript: null, // not needed for insights
  }))

  const trends = computeTrends(callRows)
  const gaps = findFollowUpGaps(callRows)
  const cards = generateInsightCards(trends, gaps, callRows)

  return NextResponse.json({ cards, trends, gaps })
}
