/**
 * GET  /api/dashboard/knowledge/docs?client_id=…
 * DELETE /api/dashboard/knowledge/docs?id=…&client_id=…
 *
 * GET  — list client_knowledge_docs rows for a client (filename, char_count, created_at).
 * DELETE — remove a doc record + all knowledge_doc-sourced chunks for that client,
 *          then syncClientTools() to keep agent tool registration current.
 *
 * Auth: admin or owner. Owners scoped to their own client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { syncClientTools } from '@/lib/sync-client-tools'

async function resolveClientId(
  req: NextRequest,
  cu: { role: string; client_id: string },
): Promise<{ clientId: string | null; error?: NextResponse }> {
  const clientIdParam = req.nextUrl.searchParams.get('client_id')
  if (cu.role === 'admin') {
    if (!clientIdParam) return { clientId: null, error: NextResponse.json({ error: 'client_id required' }, { status: 400 }) }
    return { clientId: clientIdParam }
  }
  // Owner — use their own client; ignore any supplied param
  return { clientId: cu.client_id }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientId, error } = await resolveClientId(req, cu as { role: string; client_id: string })
  if (error) return error
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const svc = createServiceClient()

  // Fetch chunk counts per source_run_id to show doc-level stats
  const { data: docs, error: docsErr } = await svc
    .from('client_knowledge_docs')
    .select('id, filename, char_count, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (docsErr) {
    console.error('[knowledge-docs] fetch error:', docsErr)
    return NextResponse.json({ error: 'Failed to fetch docs' }, { status: 500 })
  }

  // Get chunk counts grouped by source for knowledge_doc source
  const { data: chunkCounts } = await svc
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: false })
    .eq('client_id', clientId)
    .eq('source', 'knowledge_doc')

  const totalChunks = chunkCounts?.length ?? 0

  return NextResponse.json({ docs: docs ?? [], totalChunks })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { clientId, error } = await resolveClientId(req, cu as { role: string; client_id: string })
  if (error) return error
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const svc = createServiceClient()

  // Verify the doc belongs to this client
  const { data: doc } = await svc
    .from('client_knowledge_docs')
    .select('id, filename, client_id')
    .eq('id', docId)
    .eq('client_id', clientId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete the doc record
  const { error: deleteDocErr } = await svc
    .from('client_knowledge_docs')
    .delete()
    .eq('id', docId)
    .eq('client_id', clientId)

  if (deleteDocErr) {
    console.error('[knowledge-docs] delete doc error:', deleteDocErr)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  // Check if there are remaining docs — if none remain, delete all knowledge_doc chunks
  const { count: remainingDocs } = await svc
    .from('client_knowledge_docs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if ((remainingDocs ?? 0) === 0) {
    // No docs left — safe to delete all knowledge_doc chunks
    await svc
      .from('knowledge_chunks')
      .delete()
      .eq('client_id', clientId)
      .eq('source', 'knowledge_doc')
  }

  // Sync agent tools (may deregister queryKnowledge if no chunks remain)
  try {
    await syncClientTools(svc, clientId)
  } catch (syncErr) {
    console.error('[knowledge-docs] syncClientTools error (non-fatal):', syncErr)
  }

  return NextResponse.json({ ok: true, filename: doc.filename })
}
