/**
 * GET  /api/dashboard/test-scenarios?client_id=&slug=
 * POST /api/dashboard/test-scenarios
 * Auth: Supabase session, admin role required
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
  const slug = params.get('slug')
  const clientIdParam = params.get('client_id')

  let clientId = clientIdParam || cu.client_id

  if (slug) {
    const { data: c } = await supabase.from('clients').select('id').eq('slug', slug).single()
    if (c) clientId = c.id
  }

  const { data, error } = await supabase
    .from('test_scenarios')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenarios: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, description, expected_status, transcript, caller_phone, duration_seconds, tags, client_id } = body

  if (!name || !expected_status || !transcript) {
    return NextResponse.json({ error: 'name, expected_status, and transcript are required' }, { status: 400 })
  }

  const targetClientId = client_id || cu.client_id

  const { data, error } = await supabase
    .from('test_scenarios')
    .insert({ client_id: targetClientId, name, description, expected_status, transcript, caller_phone, duration_seconds, tags })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenario: data }, { status: 201 })
}
