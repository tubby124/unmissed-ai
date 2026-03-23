/**
 * GET /api/dashboard/analysis
 * Returns call_analysis_reports for admin, newest first.
 * Auth: Supabase session, admin role
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cuRows } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).order('role').limit(1)
  const cu = cuRows?.[0] ?? null
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const params = req.nextUrl.searchParams
  const clientId = params.get('client_id') || cu.client_id
  const limit = Math.min(parseInt(params.get('limit') || '20'), 50)

  const { data, error } = await supabase
    .from('call_analysis_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('analyzed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}
