/**
 * POST /api/dashboard/knowledge/add-snippet
 *
 * Save a transcript snippet from a call detail page directly into the agent's
 * knowledge base. This is the "raw augmentation" companion to QuickAddFaq —
 * QuickAddFaq writes a Q/A pair, this writes a contextual snippet so the agent
 * can search it via queryKnowledge even before someone hand-writes the FAQ.
 *
 * Body: { client_id?, topic, snippet, call_id? }
 *
 * Source: 'call_snippet' | trustTier: 'medium' | status: 'approved'
 * Plan gate: knowledgeEnabled. NOT counted against maxKnowledgeSources.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, type ChunkInput } from '@/lib/embeddings'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import { syncClientTools } from '@/lib/sync-client-tools'

const MAX_SNIPPET = 4000
const MAX_TOPIC = 200

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    topic?: string
    snippet?: string
    call_id?: string
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const topic = (body.topic ?? '').trim().slice(0, MAX_TOPIC)
  const snippet = (body.snippet ?? '').trim().slice(0, MAX_SNIPPET)
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  if (!snippet) return NextResponse.json({ error: 'snippet is required' }, { status: 400 })

  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('slug, selected_plan, subscription_status, knowledge_backend')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const plan = getPlanEntitlements(
    (client.subscription_status as string | null) === 'trialing'
      ? 'trial'
      : (client.selected_plan as string | null),
  )

  if (!plan.knowledgeEnabled) {
    return NextResponse.json(
      { error: 'Knowledge add-on is not available on your plan. Upgrade to add snippets.' },
      { status: 403 },
    )
  }

  if (client.knowledge_backend !== 'pgvector') {
    return NextResponse.json(
      { error: 'Snippets require pgvector backend. Contact support to enable.' },
      { status: 409 },
    )
  }

  const composed = `Topic: ${topic}\n\n${snippet}`

  const chunks: ChunkInput[] = [{
    content: composed,
    chunkType: 'document',
    source: 'call_snippet',
    status: 'approved',
    trustTier: 'medium',
  }]

  // Count existing approved chunks BEFORE insert — used to detect "first chunk" → tool sync
  const { count: priorApproved } = await svc
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'approved')

  try {
    await embedChunks(clientId, chunks, `call-snippet-${body.call_id ?? Date.now()}`)
    console.log(`[add-snippet] client=${client.slug} topic="${topic}" chars=${composed.length}`)
  } catch (err) {
    console.error('[add-snippet] Embedding failed:', err)
    return NextResponse.json({ error: 'Failed to embed snippet' }, { status: 500 })
  }

  // Tool sync only when the agent JUST went from 0 → 1+ approved chunks (first time enabling queryKnowledge)
  if ((priorApproved ?? 0) === 0) {
    try {
      await syncClientTools(svc, clientId)
    } catch (err) {
      console.error('[add-snippet] tools sync failed:', err)
    }
  }

  return NextResponse.json({ ok: true, topic, charCount: composed.length })
}
