import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, prepareFactChunks, prepareQaChunks, deleteClientChunks } from '@/lib/embeddings'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const clientId = body.clientId?.trim()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const svc = createServiceClient()

  // ── Load client row ────────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_facts, extra_qa')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // ── Prepare chunks ─────────────────────────────────────────────────────────
  const factChunks = prepareFactChunks(client.business_facts as string | null)
  const qaChunks = prepareQaChunks(
    (Array.isArray(client.extra_qa) ? client.extra_qa : []) as { q: string; a: string }[],
  )
  const allChunks = [...factChunks, ...qaChunks]

  if (allChunks.length === 0) {
    return NextResponse.json({ error: 'No business_facts or extra_qa to embed' }, { status: 400 })
  }

  // ── Clear old website_scrape chunks and embed new ones ─────────────────────
  const sourceRunId = crypto.randomUUID()
  await deleteClientChunks(clientId, 'website_scrape')
  const result = await embedChunks(clientId, allChunks, sourceRunId)

  // ── Set knowledge_backend = pgvector ───────────────────────────────────────
  await svc
    .from('clients')
    .update({ knowledge_backend: 'pgvector' })
    .eq('id', clientId)

  console.log(`[backfill-knowledge] slug=${client.slug} chunks=${allChunks.length} stored=${result.stored} failed=${result.failed} runId=${sourceRunId}`)

  return NextResponse.json({
    success: true,
    slug: client.slug,
    sourceRunId,
    chunks: allChunks.length,
    ...result,
  })
}
