/**
 * PATCH  /api/dashboard/services/:id  — update a service (partial update)
 * DELETE /api/dashboard/services/:id  — delete a service
 *
 * Ownership enforced: non-admin may only operate on services belonging to their client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { validateServiceWrite } from '@/lib/service-catalog'
import { syncServiceCatalogToPrompt } from '@/lib/service-catalog-sync'

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Only validate if name is being changed (full validation requires name)
  if (body.name !== undefined) {
    const validationError = validateServiceWrite(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const svc = createServiceClient()

  // Verify service exists and belongs to caller's client
  const { data: existing } = await svc
    .from('client_services')
    .select('client_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  if (cu.role !== 'admin' && existing.client_id !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = (body.name as string).trim()
  if (body.description !== undefined) updates.description = (body.description as string).trim()
  if (body.category !== undefined) updates.category = (body.category as string).trim()
  if ('duration_mins' in body) updates.duration_mins = body.duration_mins ?? null
  if (body.price !== undefined) updates.price = (body.price as string).trim()
  if (body.booking_notes !== undefined) updates.booking_notes = (body.booking_notes as string).trim()
  if (body.active !== undefined) updates.active = Boolean(body.active)
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order)

  const { data: service, error } = await svc
    .from('client_services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[services PATCH] update error:', error.message)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }

  // D260: Sync service catalog to prompt + Ultravox (fire-and-forget)
  syncServiceCatalogToPrompt(existing.client_id).catch(err =>
    console.error('[services PATCH] Service sync failed:', err)
  )

  return NextResponse.json({ service })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  const { data: existing } = await svc
    .from('client_services')
    .select('client_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  if (cu.role !== 'admin' && existing.client_id !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await svc
    .from('client_services')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[services DELETE] delete error:', error.message)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }

  // D260: Sync service catalog to prompt + Ultravox (fire-and-forget)
  syncServiceCatalogToPrompt(existing.client_id).catch(err =>
    console.error('[services DELETE] Service sync failed:', err)
  )

  return NextResponse.json({ ok: true })
}
