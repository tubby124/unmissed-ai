import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))
  const { chunkId, action, trustTier, editedContent } = body as {
    chunkId?: string
    action?: 'approve' | 'reject' | 'revoke'
    trustTier?: 'high' | 'medium' | 'low'
    editedContent?: string
  }

  if (!chunkId || !action) {
    return NextResponse.json({ error: 'chunkId and action are required' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject' && action !== 'revoke') {
    return NextResponse.json({ error: 'action must be "approve", "reject", or "revoke"' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Verify the chunk exists and belongs to a client this user can manage
  const { data: chunk } = await svc
    .from('knowledge_chunks')
    .select('id, client_id, content')
    .eq('id', chunkId)
    .single()

  if (!chunk) {
    return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })
  }

  // Phase 3 Wave B: scope guard targets the chunk's client_id.
  const resolved = await resolveAdminScope({
    supabase,
    req,
    body: { ...body, client_id: chunk.client_id as string },
  })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role !== 'admin' && scope.role !== 'owner') {
    return new NextResponse('Forbidden — only admin or owner can approve chunks', { status: 403 })
  }
  if (scope.role !== 'admin' && chunk.client_id !== scope.ownClientId) {
    return new NextResponse('Forbidden — chunk belongs to another client', { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (action === 'approve') {
    updates.status = 'approved'
    if (trustTier && ['high', 'medium', 'low'].includes(trustTier)) {
      updates.trust_tier = trustTier
    }
    if (typeof editedContent === 'string' && editedContent.trim() && editedContent.trim() !== chunk.content) {
      updates.content = editedContent.trim()
      // Re-embed when content changes — stale embeddings break search
      const newEmbedding = await embedText(editedContent.trim())
      if (newEmbedding) {
        updates.embedding = JSON.stringify(newEmbedding)
      }
    }
  } else if (action === 'revoke') {
    updates.status = 'revoked'
  } else {
    updates.status = 'rejected'
  }

  const { error } = await svc
    .from('knowledge_chunks')
    .update(updates)
    .eq('id', chunkId)

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/knowledge/approve',
        method: 'POST',
        payload: { chunk_id: chunkId, action },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // S5: rebuild clients.tools when approved chunk count may have changed
  // This ensures queryKnowledge tool is added/removed when crossing the 0-boundary
  // S7e: awaited (fire-and-forget not safe in Next.js route handlers)
  try { await syncClientTools(svc, chunk.client_id) } catch (err) {
    console.error(`[knowledge/approve] tools sync failed: ${err}`)
  }

  // G5: When a chunk is approved, try to auto-resolve open gaps that the new content answers.
  // Uses the chunk's embedding to find semantically similar unresolved questions.
  let gapsResolved = 0
  if (action === 'approve') {
    try {
      const approvedContent = typeof editedContent === 'string' && editedContent.trim()
        ? editedContent.trim()
        : chunk.content
      const chunkEmbedding = await embedText(approvedContent)
      if (chunkEmbedding) {
        const { data: cascadeResult } = await svc.rpc('auto_resolve_similar_gaps', {
          p_client_id: chunk.client_id,
          p_query_embedding: JSON.stringify(chunkEmbedding),
          p_source_query: approvedContent.slice(0, 200),
          p_similarity_threshold: 0.78,
          p_max_resolve: 20,
        })
        gapsResolved = cascadeResult?.[0]?.resolved_count ?? 0
        if (gapsResolved > 0) {
          console.log(`[knowledge/approve] Auto-resolved ${gapsResolved} gaps after approving chunk ${chunkId}`)
        }
      }
    } catch (gapErr) {
      console.error('[knowledge/approve] Gap auto-resolve failed (non-fatal):', gapErr)
    }
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/knowledge/approve',
      method: 'POST',
      payload: { chunk_id: chunkId, action, trust_tier: trustTier, edited_content: !!editedContent, gaps_resolved: gapsResolved },
    })
  }

  return NextResponse.json({ ok: true, action, chunkId, gaps_resolved: gapsResolved })
}

