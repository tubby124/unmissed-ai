import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!cu) return new NextResponse('Forbidden', { status: 403 })

  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let query = supabase
    .from('outbound_templates')
    .select('*')
    .order('is_builtin', { ascending: false })
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  query = query.or(`client_id.eq.${clientId},is_builtin.eq.true`)

  const { data: templates, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { client_id, name, description, tone, goal, opening, vm_script, call_notes, special_instructions } = body

  if (!client_id || !name || !goal) {
    return NextResponse.json({ error: 'client_id, name, and goal required' }, { status: 400 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!cu || (cu.role !== 'admin' && cu.client_id !== client_id)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: template, error } = await supabase
    .from('outbound_templates')
    .insert({
      client_id,
      name,
      description: description || null,
      tone: tone || 'warm',
      goal,
      opening: opening || null,
      vm_script: vm_script || null,
      call_notes: call_notes || null,
      special_instructions: special_instructions || null,
      is_builtin: false,
      is_default: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template }, { status: 201 })
}
