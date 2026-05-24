import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Fetch template + check auth
  const { data: tpl, error: tplErr } = await supabase
    .from('outbound_templates')
    .select('id, client_id, is_builtin')
    .eq('id', id)
    .single()

  if (tplErr || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (tpl.is_builtin) return NextResponse.json({ error: 'Cannot modify built-in template' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!cu || (cu.role !== 'admin' && cu.client_id !== tpl.client_id)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const allowed = ['name', 'description', 'tone', 'goal', 'opening', 'vm_script', 'call_notes', 'special_instructions']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }

  const { data: updated, error } = await supabase
    .from('outbound_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: tpl, error: tplErr } = await supabase
    .from('outbound_templates')
    .select('id, client_id, is_builtin')
    .eq('id', id)
    .single()

  if (tplErr || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (tpl.is_builtin) return NextResponse.json({ error: 'Cannot delete built-in template' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!cu || (cu.role !== 'admin' && cu.client_id !== tpl.client_id)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { error } = await supabase.from('outbound_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}