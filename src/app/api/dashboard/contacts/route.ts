import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNA } from '@/lib/utils/phone'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

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
  const body = await req.json()

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const { phone, name, email, tags, notes, is_vip, vip_relationship, vip_notes, transfer_enabled, preferences } = body

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const normalized = normalizePhoneNA(phone)
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid North American phone number' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    client_id: scope.targetClientId,
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

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/contacts',
        method: 'POST',
        payload: { phone: normalized, is_vip: !!is_vip },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/contacts',
      method: 'POST',
      payload: { contact_id: contact.id, phone: normalized, is_vip: !!is_vip },
    })
  }

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

  // Phase 3 Wave B: if admin is editing another client's contact, run scope guard.
  // Use the contact's client_id as the target so the guard fires correctly.
  const scopedBody: Record<string, unknown> = { ...body, client_id: existing.client_id as string }
  const resolved = await resolveAdminScope({ supabase, req, body: scopedBody })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

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

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/contacts',
        method: 'PATCH',
        payload: { contact_id: id, fields: Object.keys(fields) },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/contacts',
      method: 'PATCH',
      payload: { contact_id: id, fields: Object.keys(fields) },
    })
  }

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

  // Phase 3 Wave B scope guard
  const scopedBody: Record<string, unknown> = { ...body, client_id: existing.client_id as string }
  const resolved = await resolveAdminScope({ supabase, req, body: scopedBody })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const { error } = await supabase
    .from('client_contacts')
    .delete()
    .eq('id', id)

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/contacts',
        method: 'DELETE',
        payload: { contact_id: id },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/contacts',
      method: 'DELETE',
      payload: { contact_id: id },
    })
  }

  return NextResponse.json({ ok: true })
}
