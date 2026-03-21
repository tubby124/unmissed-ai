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
    .single()

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
  syncClientTools(svc, chunk.client_id).catch(err =>
    console.error(`[knowledge/approve] tools sync failed: ${err}`)
  )

  return NextResponse.json({ ok: true, action, chunkId })
}

