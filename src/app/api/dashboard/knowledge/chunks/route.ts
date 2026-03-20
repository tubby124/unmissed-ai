import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const chunkId = req.nextUrl.searchParams.get('id')
  if (!chunkId) return NextResponse.json({ error: 'Missing chunk id' }, { status: 400 })

  const svc = createServiceClient()

  // Verify chunk exists and belongs to user's client
  const { data: chunk } = await svc
    .from('knowledge_chunks')
    .select('id, client_id')
    .eq('id', chunkId)
    .single()

  if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })

  // Admin can delete any, owners can only delete their own client's chunks
  if (cu.role !== 'admin' && chunk.client_id !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { error } = await svc
    .from('knowledge_chunks')
    .delete()
    .eq('id', chunkId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: chunkId })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id
  const statusFilter = params.get('status') ?? 'all'
  const trustTierFilter = params.get('trust_tier') ?? 'all'
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 200)
  const offset = parseInt(params.get('offset') ?? '0', 10)

  const svc = createServiceClient()
  let query = svc
    .from('knowledge_chunks')
    .select('id, client_id, content, source, chunk_type, status, trust_tier, metadata, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (trustTierFilter !== 'all') {
    query = query.eq('trust_tier', trustTierFilter)
  }

  const { data: chunks, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get total count for pagination
  let countQuery = svc
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (statusFilter !== 'all') {
    countQuery = countQuery.eq('status', statusFilter)
  }
  if (trustTierFilter !== 'all') {
    countQuery = countQuery.eq('trust_tier', trustTierFilter)
  }

  const { count } = await countQuery

  return NextResponse.json({
    chunks: chunks ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
