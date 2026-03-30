import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

async function getAuth() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false, ownerClientId: null as string | null }
  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  const isAdmin = cu?.role === 'admin'
  const ownerClientId = !isAdmin ? (cu?.client_id ?? null) : null
  return { supabase, user, isAdmin, ownerClientId }
}

// Keep old name for routes that require admin
async function requireAdmin() {
  const auth = await getAuth()
  return auth
}

export async function GET(req: NextRequest) {
  const { supabase, user, isAdmin, ownerClientId } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('campaign_leads')
    .select('id, client_id, phone, name, status, notes, added_at, last_called_at, clients(business_name)')
    .order('added_at', { ascending: false })

  if (!isAdmin) {
    if (!ownerClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    query = query.eq('client_id', ownerClientId)
  } else {
    if (clientId) query = query.eq('client_id', clientId)
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data })
}

export async function POST(req: NextRequest) {
  const { supabase, user, isAdmin, ownerClientId } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { phone, name, notes } = body
  let { client_id } = body

  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

  // Non-admin owners can only add leads for their own client
  if (!isAdmin) {
    if (!ownerClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    client_id = ownerClientId
  }

  const { data, error } = await supabase
    .from('campaign_leads')
    .insert({ phone, name: name || null, client_id: client_id || null, notes: notes || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, isAdmin, ownerClientId } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, status, notes } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (!isAdmin) {
    if (!ownerClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: lead } = await supabase
      .from('campaign_leads')
      .select('client_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
    if (!lead || lead.client_id !== ownerClientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (status === 'called') updates.last_called_at = new Date().toISOString()
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await supabase
    .from('campaign_leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data })
}
