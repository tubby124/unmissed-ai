import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/dashboard/vip-contacts?client_id=... — list all VIP contacts for a client
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  // Verify user belongs to this client
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('client_vip_contacts')
    .select('id, name, phone, relationship, notes, document_url, transfer_enabled, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/dashboard/vip-contacts — add a new VIP contact
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { client_id?: string; name?: string; phone?: string; relationship?: string; notes?: string; document_url?: string; transfer_enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, name, phone, relationship, notes, document_url, transfer_enabled } = body
  if (!client_id || !name || !phone) {
    return NextResponse.json({ error: 'client_id, name, and phone are required' }, { status: 400 })
  }

  // E.164 NANP validation
  if (!/^\+1[2-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'Phone must be E.164 format (+1XXXXXXXXXX)' }, { status: 400 })
  }

  // Verify user belongs to this client
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', client_id)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('client_vip_contacts')
    .insert({
      client_id,
      name,
      phone,
      relationship: relationship ?? null,
      notes: notes ?? null,
      document_url: document_url ?? null,
      transfer_enabled: transfer_enabled ?? true,
    })
    .select('id, name, phone, relationship, notes, document_url, transfer_enabled, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A VIP contact with this phone number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
