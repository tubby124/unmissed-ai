import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'

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
  if (cu.role !== 'admin' && cu.role !== 'owner') {
    return new NextResponse('Forbidden — only admin or owner can approve chunks', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { chunkId, action, trustTier, editedContent } = body as {
    chunkId?: string
    action?: 'approve' | 'reject'
    trustTier?: 'high' | 'medium' | 'low'
    editedContent?: string
  }

  if (!chunkId || !action) {
    return NextResponse.json({ error: 'chunkId and action are required' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
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

  // Non-admin users can only approve chunks for their own client
  if (cu.role !== 'admin' && chunk.client_id !== cu.client_id) {
    return new NextResponse('Forbidden — chunk belongs to another client', { status: 403 })
  }

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
  } else {
    updates.status = 'rejected'
  }

  const { error } = await svc
    .from('knowledge_chunks')
    .update(updates)
    .eq('id', chunkId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json({ ok: true, action, chunkId, gaps_resolved: gapsResolved })
}

