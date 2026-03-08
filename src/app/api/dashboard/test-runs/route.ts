/**
 * GET /api/dashboard/test-runs
 * Returns recent test_runs for admin. Auth: session + admin role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const params = req.nextUrl.searchParams
  const clientId = params.get('client_id') || cu.client_id
  const limit = Math.min(parseInt(params.get('limit') || '20'), 50)

  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .eq('client_id', clientId)
    .order('ran_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ runs: data })
}
