import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()

  // Verify session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get the user's client + role
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) {
    return new NextResponse('No client found', { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  // Admin can edit any client by passing client_id in body
  let targetClientId = cu.client_id
  if (cu.role === 'admin' && body.client_id) {
    targetClientId = body.client_id
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.system_prompt === 'string') {
    updates.system_prompt = body.system_prompt
    updates.updated_at = new Date().toISOString()
  }
  if (body.status === 'active' || body.status === 'paused') {
    updates.status = body.status
  }

  if (!Object.keys(updates).length) {
    return new NextResponse('Nothing to update', { status: 400 })
  }

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', targetClientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
