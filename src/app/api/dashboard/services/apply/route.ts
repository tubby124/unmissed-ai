/**
 * POST /api/dashboard/services/apply
 *
 * Inserts approved ServiceDraft rows into client_services.
 * Called after user reviews AI-generated drafts from /analyze.
 *
 * Body: { drafts: ServiceDraft[], client_id?: string (admin only) }
 * Response: { inserted: number, services: ClientService[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { validateServiceWrite } from '@/lib/service-catalog'

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

  const body = await req.json().catch(() => ({})) as { drafts?: unknown[]; client_id?: string }

  let clientId: string | null
  if (cu.role === 'admin' && body.client_id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(body.client_id)) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 })
    }
    clientId = body.client_id
  } else {
    clientId = cu.client_id
  }
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  if (!Array.isArray(body.drafts) || body.drafts.length === 0) {
    return NextResponse.json({ error: 'drafts must be a non-empty array' }, { status: 400 })
  }
  if (body.drafts.length > 50) {
    return NextResponse.json({ error: 'Too many drafts (max 50)' }, { status: 400 })
  }

  // Validate each draft
  for (const draft of body.drafts) {
    const err = validateServiceWrite(draft)
    if (err) return NextResponse.json({ error: `Draft validation failed: ${err}` }, { status: 400 })
  }

  const rows = (body.drafts as Record<string, unknown>[]).map((d, i) => ({
    client_id: clientId as string,
    name: (d.name as string).trim(),
    description: (d.description as string | undefined)?.trim() ?? '',
    category: (d.category as string | undefined)?.trim() ?? '',
    duration_mins:
      typeof d.duration_mins === 'number' && d.duration_mins > 0
        ? Math.round(d.duration_mins)
        : null,
    price: (d.price as string | undefined)?.trim() ?? '',
    booking_notes: (d.booking_notes as string | undefined)?.trim() ?? '',
    active: true,
    sort_order: i,
  }))

  const svc = createServiceClient()
  const { data: services, error } = await svc
    .from('client_services')
    .insert(rows)
    .select()

  if (error) {
    console.error('[services/apply] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to apply services' }, { status: 500 })
  }

  return NextResponse.json({ inserted: services?.length ?? 0, services: services ?? [] })
}
