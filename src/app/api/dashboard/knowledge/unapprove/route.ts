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
    return new NextResponse('Forbidden — only admin or owner can unapprove chunks', { status: 403 })
  }

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

  // Non-admin users can only unapprove their own client's chunks
  if (cu.role !== 'admin' && chunk.client_id !== cu.client_id) {
    return new NextResponse('Forbidden — chunk belongs to another client', { status: 403 })
  }

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // S5: rebuild clients.tools — if this was the last approved chunk,
  // queryKnowledge tool should be de-registered
  try { await syncClientTools(svc, chunk.client_id) } catch (err) {
    console.error(`[knowledge/unapprove] tools sync failed: ${err}`)
  }

  return NextResponse.json({ ok: true, chunkId, newStatus: 'pending' })
}
