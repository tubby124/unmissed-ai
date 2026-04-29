import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'
import { scheduleAutoRegen } from '@/lib/auto-regen'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const params = req.nextUrl.searchParams
  const chunkId = params.get('id')
  const clearAll = params.get('clear_all') === 'true'

  const svc = createServiceClient()

  // ── Bulk clear ────────────────────────────────────────────────────────────
  if (clearAll) {
    const rawClientId = params.get('client_id')
    const queryClientId = rawClientId ?? null
    const resolved = await resolveAdminScope({
      supabase,
      req,
      body: null,
      queryClientId,
    })
    if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
    const { scope } = resolved
    const targetClientId = scope.targetClientId
    if (!targetClientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
    if (scope.role !== 'admin' && targetClientId !== scope.ownClientId) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const denied = rejectIfEditModeRequired(scope)
    if (denied) return denied

    let query = svc.from('knowledge_chunks').delete().eq('client_id', targetClientId)
    const sourceFilter = params.get('source')
    if (sourceFilter) query = query.eq('source', sourceFilter)
    const statusFilter = params.get('status')
    if (statusFilter) query = query.eq('status', statusFilter)

    const { error } = await query
    if (error) {
      if (scope.guard.isCrossClient) {
        void auditAdminWrite({
          scope,
          route: '/api/dashboard/knowledge/chunks',
          method: 'DELETE',
          payload: { client_id: targetClientId, clear_all: true, source: sourceFilter, status: statusFilter },
          status: 'error',
          errorMessage: error.message,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    try { await syncClientTools(svc, targetClientId) } catch (err) {
      console.error(`[knowledge/chunks DELETE clear_all] tools sync failed: ${err}`)
    }

    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/knowledge/chunks',
        method: 'DELETE',
        payload: { client_id: targetClientId, clear_all: true, source: sourceFilter, status: statusFilter },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Single chunk delete ───────────────────────────────────────────────────
  if (!chunkId) return NextResponse.json({ error: 'Missing chunk id or clear_all=true' }, { status: 400 })

  const { data: chunk } = await svc
    .from('knowledge_chunks')
    .select('id, client_id')
    .eq('id', chunkId)
    .single()

  if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })

  // Phase 3 Wave B scope guard: target = chunk's client_id
  const resolved = await resolveAdminScope({
    supabase,
    req,
    body: { client_id: chunk.client_id as string },
  })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role !== 'admin' && chunk.client_id !== scope.ownClientId) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const { error } = await svc
    .from('knowledge_chunks')
    .delete()
    .eq('id', chunkId)

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/knowledge/chunks',
        method: 'DELETE',
        payload: { chunk_id: chunkId },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try { await syncClientTools(svc, chunk.client_id) } catch (err) {
    console.error(`[knowledge/chunks DELETE] tools sync failed: ${err}`)
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/knowledge/chunks',
      method: 'DELETE',
      payload: { chunk_id: chunkId },
    })
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
    .order('role').limit(1).maybeSingle()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id
  const statusFilter = params.get('status') ?? 'all'
  const trustTierFilter = params.get('trust_tier') ?? 'all'
  const sourceFilter = params.get('source') ?? 'all'
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
  if (sourceFilter !== 'all') {
    query = query.eq('source', sourceFilter)
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
  if (sourceFilter !== 'all') {
    countQuery = countQuery.eq('source', sourceFilter)
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
  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    content?: string
    chunk_type?: string
    trust_tier?: string
    source?: string
    auto_approve?: boolean
    edit_mode_confirmed?: boolean
  }

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied
  const user = scope.user
  const cu = { role: scope.role, client_id: scope.ownClientId }

  const clientId = scope.targetClientId
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
  // Admins and owners can auto-approve their own chunks (owners only for their own client)
  const canAutoApprove = cu.role === 'admin' || cu.role === 'owner'
  const status = body.auto_approve && canAutoApprove ? 'approved' : 'pending'

  // Generate embedding — if unavailable (no API key or outage), save without it
  const embedding = await embedText(content)
  const effectiveStatus = embedding ? status : 'pending_embed'

  const svc = createServiceClient()
  const insertRow: Record<string, unknown> = {
    client_id: clientId,
    content,
    chunk_type: chunkType,
    trust_tier: trustTier,
    source,
    status: effectiveStatus,
    metadata: { added_by: user.id },
    source_run_id: `manual-${Date.now()}`,
  }
  if (embedding) insertRow.embedding = JSON.stringify(embedding)

  const { data: chunk, error } = await svc
    .from('knowledge_chunks')
    .insert(insertRow)
    .select('id, content, status, trust_tier, source, chunk_type, created_at')
    .single()

  if (error) {
    console.error('[knowledge/chunks POST]', error)
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/knowledge/chunks',
        method: 'POST',
        payload: { client_id: clientId, chunk_type: chunkType, source, status: effectiveStatus },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // S5: if auto-approved, rebuild clients.tools to include queryKnowledge
  // S7e: awaited (fire-and-forget not safe in Next.js route handlers)
  if (effectiveStatus === 'approved') {
    try { await syncClientTools(svc, clientId) } catch (err) {
      console.error(`[knowledge/chunks POST] tools sync failed: ${err}`)
    }
    scheduleAutoRegen(clientId, 'auto:faq_added')
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/knowledge/chunks',
      method: 'POST',
      payload: { client_id: clientId, chunk_id: chunk.id, status: effectiveStatus },
    })
  }
  return NextResponse.json({ ok: true, chunk, embedding_pending: !embedding })
}

