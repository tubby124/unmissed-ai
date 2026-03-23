/**
 * DELETE /api/dashboard/test-scenarios/[id]
 * PATCH  /api/dashboard/test-scenarios/[id]
 * Auth: admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cuRows } = await supabase.from('client_users').select('role').eq('user_id', user.id).order('role').limit(1)
  const cu = cuRows?.[0] ?? null
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const { error } = await supabase.from('test_scenarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cuRows } = await supabase.from('client_users').select('role').eq('user_id', user.id).order('role').limit(1)
  const cu = cuRows?.[0] ?? null
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const allowed = ['name', 'description', 'expected_status', 'transcript', 'caller_phone', 'duration_seconds', 'tags']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase.from('test_scenarios').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ scenario: data })
}
