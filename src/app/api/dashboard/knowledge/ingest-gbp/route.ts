import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { seedKnowledgeFromGBP } from '@/lib/seed-knowledge'

/**
 * POST /api/dashboard/knowledge/ingest-gbp
 * Seeds knowledge_chunks from the client's stored GBP fields (gbp_summary, city, state, etc.).
 * Source = 'gbp', status = 'approved', trust_tier = 'medium'.
 * Safe to re-run: deletes prior 'gbp' chunks before reseeding.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id

  const svc = createServiceClient()

  // If new GBP fields were provided in the body (from the dashboard connect flow), save them first
  if (body.gbp_place_id || body.gbp_summary) {
    const gbpFields: Record<string, unknown> = {}
    if (body.gbp_place_id) gbpFields.gbp_place_id = body.gbp_place_id
    if (body.gbp_summary !== undefined) gbpFields.gbp_summary = body.gbp_summary
    if (body.gbp_rating !== undefined) gbpFields.gbp_rating = body.gbp_rating
    if (body.gbp_review_count !== undefined) gbpFields.gbp_review_count = body.gbp_review_count
    if (body.gbp_photo_url !== undefined) gbpFields.gbp_photo_url = body.gbp_photo_url
    if (body.city) gbpFields.city = body.city
    if (body.state) gbpFields.state = body.state
    await svc.from('clients').update(gbpFields).eq('id', targetClientId)
  }

  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, gbp_summary, gbp_rating, gbp_review_count, city, state')
    .eq('id', targetClientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!client.gbp_summary && !client.city && !client.state) {
    return NextResponse.json({ error: 'No GBP data available to seed' }, { status: 400 })
  }

  const result = await seedKnowledgeFromGBP(svc, {
    clientId: client.id,
    clientSlug: client.slug,
    businessName: client.business_name,
    gbpSummary: client.gbp_summary,
    gbpRating: client.gbp_rating,
    gbpReviewCount: client.gbp_review_count,
    city: client.city,
    state: client.state,
  })

  return NextResponse.json(result)
}
