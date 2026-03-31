/**
 * GET  /api/dashboard/services  — list services for a client (sorted by sort_order, created_at)
 * POST /api/dashboard/services  — create a new service
 *
 * GET  ?client_id=<uuid>  (admin only — defaults to own client)
 * POST body: ClientServiceWrite + optional client_id (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { validateServiceWrite } from '@/lib/service-catalog'
import { syncServiceCatalogToPrompt } from '@/lib/service-catalog-sync'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clientIdParam = searchParams.get('client_id')

  let clientId: string | null
  if (cu.role === 'admin' && clientIdParam) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clientIdParam)) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 })
    }
    clientId = clientIdParam
  } else {
    clientId = cu.client_id
  }
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  const svc = createServiceClient()
  const { data: services, error } = await svc
    .from('client_services')
    .select('id, client_id, name, description, category, duration_mins, price, booking_notes, active, sort_order, created_at, updated_at')
    .eq('client_id', clientId)
    .order('sort_order')
    .order('created_at')

  if (error) {
    console.error('[services GET] query error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }

  return NextResponse.json({ services: services ?? [] })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

  const validationError = validateServiceWrite(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  let clientId: string | null
  if (cu.role === 'admin' && body.client_id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.client_id as string)) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 })
    }
    clientId = body.client_id as string
  } else {
    clientId = cu.client_id
  }
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  const svc = createServiceClient()
  const { data: service, error } = await svc
    .from('client_services')
    .insert({
      client_id: clientId,
      name: (body.name as string).trim(),
      description: (body.description as string | undefined)?.trim() ?? '',
      category: (body.category as string | undefined)?.trim() ?? '',
      duration_mins: body.duration_mins ?? null,
      price: (body.price as string | undefined)?.trim() ?? '',
      booking_notes: (body.booking_notes as string | undefined)?.trim() ?? '',
      active: body.active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[services POST] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }

  // D260: Sync service catalog to prompt + Ultravox (fire-and-forget)
  syncServiceCatalogToPrompt(clientId).catch(err =>
    console.error('[services POST] Service sync failed:', err)
  )

  return NextResponse.json({ service }, { status: 201 })
}
