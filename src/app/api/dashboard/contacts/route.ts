import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNA } from '@/lib/utils/phone'

// ── Shared auth helper ──────────────────────────────────────────────────────
async function resolveAuth(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!cu) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user, cu, isAdmin: cu.role === 'admin' }
}

// ── GET — list contacts ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const auth = await resolveAuth(supabase)
  if ('error' in auth) return auth.error
  const { cu, isAdmin } = auth

  const requestedClientId = req.nextUrl.searchParams.get('client_id')
  const clientId = isAdmin && requestedClientId ? requestedClientId : cu.client_id

  const { data: contacts, error, count } = await supabase
    .from('client_contacts')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('is_vip', { ascending: false })
    .order('last_call_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contacts: contacts ?? [], total: count ?? 0 })
}

// ── POST — create contact ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const auth = await resolveAuth(supabase)
  if ('error' in auth) return auth.error
  const { cu } = auth

  const body = await req.json()
  const { phone, name, email, tags, notes, is_vip, vip_relationship, vip_notes, transfer_enabled, preferences } = body

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const normalized = normalizePhoneNA(phone)
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid North American phone number' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    client_id: cu.client_id,
    phone: normalized,
  }
  if (name !== undefined) insert.name = name
  if (email !== undefined) insert.email = email
  if (tags !== undefined) insert.tags = tags
  if (notes !== undefined) insert.notes = notes
  if (is_vip !== undefined) insert.is_vip = is_vip
  if (vip_relationship !== undefined) insert.vip_relationship = vip_relationship
  if (vip_notes !== undefined) insert.vip_notes = vip_notes
  if (transfer_enabled !== undefined) insert.transfer_enabled = transfer_enabled
  if (preferences !== undefined) insert.preferences = preferences

  const { data: contact, error } = await supabase
    .from('client_contacts')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(contact, { status: 201 })
}

// ── PATCH — update contact ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const auth = await resolveAuth(supabase)
  if ('error' in auth) return auth.error
  const { cu, isAdmin } = auth

  const body = await req.json()
  const { id, ...fields } = body

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Verify ownership (admin can edit any client's contacts)
  const { data: existing } = await supabase
    .from('client_contacts')
    .select('client_id')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (!existing || (!isAdmin && existing.client_id !== cu.client_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // If phone is being updated, normalize it
  if (fields.phone) {
    const normalized = normalizePhoneNA(fields.phone)
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid North American phone number' }, { status: 400 })
    }
    fields.phone = normalized
  }

  const { data: contact, error } = await supabase
    .from('client_contacts')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(contact)
}

// ── DELETE — delete contact ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const auth = await resolveAuth(supabase)
  if ('error' in auth) return auth.error
  const { cu, isAdmin } = auth

  const body = await req.json()
  const { id } = body

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Verify ownership (admin can delete any client's contacts)
  const { data: existing } = await supabase
    .from('client_contacts')
    .select('client_id')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  if (!existing || (!isAdmin && existing.client_id !== cu.client_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('client_contacts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
