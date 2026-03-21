import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'

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

  // S5: rebuild clients.tools — deleting an approved chunk may remove queryKnowledge tool
  // S7e: awaited (fire-and-forget not safe in Next.js route handlers)
  try { await syncClientTools(svc, chunk.client_id) } catch (err) {
    console.error(`[knowledge/chunks DELETE] tools sync failed: ${err}`)
  }

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
    .select('id, client_id, content, source, chunk_type, status, trust_tier, metadata, created_at, updated_at, hit_count, last_hit_at')
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

/**
 * POST — Add a manual knowledge chunk.
 * Embeds the content and stores it in knowledge_chunks with status=pending.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    content?: string
    chunk_type?: string
    trust_tier?: string
    source?: string
    auto_approve?: boolean
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  const content = body.content?.trim()

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: 'content exceeds 5000 character limit' }, { status: 400 })
  }

  // Permission check — non-admin can only add to their own client
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const chunkType = body.chunk_type ?? 'manual'
  const trustTier = body.trust_tier ?? 'medium'
  const source = body.source ?? 'dashboard_manual'
  // Admins can auto-approve; owners add as pending
  const status = body.auto_approve && cu.role === 'admin' ? 'approved' : 'pending'

  // Generate embedding
  const embedding = await embedText(content)
  if (!embedding) {
    return NextResponse.json({ error: 'Failed to generate embedding — try again' }, { status: 502 })
  }

  const svc = createServiceClient()
  const { data: chunk, error } = await svc
    .from('knowledge_chunks')
    .insert({
      client_id: clientId,
      content,
      chunk_type: chunkType,
      trust_tier: trustTier,
      source,
      status,
      embedding: JSON.stringify(embedding),
      metadata: { added_by: user.id },
      source_run_id: `manual-${Date.now()}`,
    })
    .select('id, content, status, trust_tier, source, chunk_type, created_at')
    .single()

  if (error) {
    console.error('[knowledge/chunks POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // S5: if auto-approved, rebuild clients.tools to include queryKnowledge
  // S7e: awaited (fire-and-forget not safe in Next.js route handlers)
  if (status === 'approved') {
    try { await syncClientTools(svc, clientId) } catch (err) {
      console.error(`[knowledge/chunks POST] tools sync failed: ${err}`)
    }
  }

  return NextResponse.json({ ok: true, chunk })
}

