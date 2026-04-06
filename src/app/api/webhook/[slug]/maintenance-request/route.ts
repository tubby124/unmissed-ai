import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Verify shared secret — Ultravox sends this as a static header
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    unit_number,
    tenant_name,
    caller_phone,
    category,
    description,
    urgency_tier,
    preferred_access_window,
    entry_permission,
    call_id,
  } = body as Record<string, unknown>

  // Validate required fields
  if (!unit_number || !tenant_name || !category || !description || !urgency_tier) {
    return NextResponse.json(
      { error: 'unit_number, tenant_name, category, description, and urgency_tier are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Look up client by slug
  const { data: client } = await supabase
    .from('clients')
    .select('id, niche')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (client.niche !== 'property_management') {
    return NextResponse.json({ error: 'Not a property management client' }, { status: 403 })
  }

  // Look up call_log_id from ultravox call_id if provided
  let call_log_id: string | null = null
  if (call_id && typeof call_id === 'string') {
    const { data: log } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', call_id)
      .eq('client_id', client.id)
      .limit(1)
      .maybeSingle()
    call_log_id = log?.id ?? null
  }

  const { data: inserted, error } = await supabase
    .from('maintenance_requests')
    .insert({
      client_id: client.id,
      unit_number: unit_number as string,
      tenant_name: tenant_name as string,
      caller_phone: (caller_phone as string | undefined) ?? null,
      category: category as string,
      description: description as string,
      urgency_tier: urgency_tier as string,
      preferred_access_window: (preferred_access_window as string | undefined) ?? null,
      entry_permission: (entry_permission as boolean | undefined) ?? null,
      call_log_id,
      created_by: 'voice_agent',
    })
    .select('id, status')
    .single()

  if (error) {
    console.error(`[maintenance-request] Insert failed for slug=${slug}: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id, status: inserted.status })
}
