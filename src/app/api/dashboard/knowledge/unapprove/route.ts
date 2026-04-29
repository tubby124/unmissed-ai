/**
 * POST /api/dashboard/knowledge/unapprove
 *
 * Transitions a chunk from 'approved' back to 'pending'.
 * Triggers syncClientTools when approved count may cross the 1→0 boundary.
 *
 * Auth: admin or owner (owners can only unapprove their own client's chunks).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { syncClientTools } from '@/lib/sync-client-tools'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))
  const { chunkId } = body as { chunkId?: string }

  if (!chunkId) {
    return NextResponse.json({ error: 'chunkId is required' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Verify chunk exists and is currently approved
  const { data: chunk } = await svc
    .from('knowledge_chunks')
    .select('id, client_id, status')
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
    return new NextResponse('Forbidden — only admin or owner can unapprove chunks', { status: 403 })
  }
  if (scope.role !== 'admin' && chunk.client_id !== scope.ownClientId) {
    return new NextResponse('Forbidden — chunk belongs to another client', { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  if (chunk.status !== 'approved') {
    return NextResponse.json({ error: `Chunk is not approved (current status: ${chunk.status})` }, { status: 400 })
  }

  // Transition approved → pending
  const { error } = await svc
    .from('knowledge_chunks')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chunkId)

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/knowledge/unapprove',
        method: 'POST',
        payload: { chunk_id: chunkId },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // S5: rebuild clients.tools — if this was the last approved chunk,
  // queryKnowledge tool should be de-registered
  try { await syncClientTools(svc, chunk.client_id) } catch (err) {
    console.error(`[knowledge/unapprove] tools sync failed: ${err}`)
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/knowledge/unapprove',
      method: 'POST',
      payload: { chunk_id: chunkId, new_status: 'pending' },
    })
  }
  return NextResponse.json({ ok: true, chunkId, newStatus: 'pending' })
}
