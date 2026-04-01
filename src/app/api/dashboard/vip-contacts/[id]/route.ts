// DEPRECATED: VIP contacts are now managed via /api/dashboard/contacts (client_contacts table).
// This route is kept temporarily for backward compatibility. Remove after 2026-04-08.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// PATCH /api/dashboard/vip-contacts/[id] — update a VIP contact
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; phone?: string; relationship?: string; notes?: string; document_url?: string; transfer_enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.phone !== undefined && !/^\+\d{7,15}$/.test(body.phone)) {
    return NextResponse.json({ error: 'Phone must be E.164 format (e.g. +14035551234)' }, { status: 400 })
  }

  // Verify user owns the contact's client (RLS also enforces, but belt-and-suspenders)
  const { data: contact } = await supabase
    .from('client_vip_contacts')
    .select('client_id')
    .eq('id', id)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', contact.client_id)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.relationship !== undefined) updates.relationship = body.relationship
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.document_url !== undefined) updates.document_url = body.document_url
  if (body.transfer_enabled !== undefined) updates.transfer_enabled = body.transfer_enabled

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_vip_contacts')
    .update(updates)
    .eq('id', id)
    .select('id, name, phone, relationship, notes, document_url, transfer_enabled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/dashboard/vip-contacts/[id] — remove a VIP contact
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contact } = await supabase
    .from('client_vip_contacts')
    .select('client_id')
    .eq('id', id)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', contact.client_id)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('client_vip_contacts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
