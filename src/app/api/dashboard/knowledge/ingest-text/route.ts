/**
 * POST /api/dashboard/knowledge/ingest-text
 *
 * Ingest raw unstructured text directly into the pgvector knowledge corpus.
 * Splits into chunks via splitIntoChunks(), embeds via embedChunks(),
 * stores an audit record in client_knowledge_docs, then syncs agent tools.
 *
 * Functionally equivalent to file upload — same plan gating (fileUploadEnabled +
 * maxKnowledgeSources), same chunking pipeline, same auto-approve path.
 *
 * Source: 'manual_text' | chunkType: 'document' | trustTier: 'high' | status: 'approved'
 *
 * Body: { text: string, title: string, client_id?: string (admin only) }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, type ChunkInput } from '@/lib/embeddings'
import { splitIntoChunks, truncateText } from '@/lib/knowledge-upload'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import { syncClientTools } from '@/lib/sync-client-tools'

const MAX_TITLE_LENGTH = 120

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
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

  // ── Parse body ───────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    text?: string
    title?: string
    client_id?: string
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawText = body.text?.trim() ?? ''
  const title = (body.title?.trim() || 'Manual text').slice(0, MAX_TITLE_LENGTH)

  if (!rawText) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  // ── Truncate (same cap as file extraction: 50K chars) ────────────────────────
  const { text: contentText, truncated } = truncateText(rawText)

  // ── Plan gate — same rules as file upload ────────────────────────────────────
  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('slug, selected_plan, subscription_status')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const plan = getPlanEntitlements(
    (client.subscription_status as string | null) === 'trialing'
      ? 'trial'
      : (client.selected_plan as string | null),
  )

  if (!plan.fileUploadEnabled) {
    return NextResponse.json(
      { error: 'Text ingestion is not available on your current plan.' },
      { status: 403 },
    )
  }

  const { count: sourceCount } = await svc
    .from('client_knowledge_docs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if ((sourceCount ?? 0) >= plan.maxKnowledgeSources) {
    return NextResponse.json(
      { error: `Source limit reached (${sourceCount}/${plan.maxKnowledgeSources}). Upgrade to add more.` },
      { status: 403 },
    )
  }

  // ── Split ─────────────────────────────────────────────────────────────────────
  const segments = splitIntoChunks(contentText)
  if (segments.length === 0) {
    return NextResponse.json({ error: 'No usable content found in the provided text' }, { status: 422 })
  }

  const chunks: ChunkInput[] = segments.map(p => ({
    content: p,
    chunkType: 'document',
    source: 'manual_text',
    status: 'approved',    // user-submitted = high trust, auto-approve
    trustTier: 'high',
  }))

  // ── Audit record ──────────────────────────────────────────────────────────────
  // Non-fatal — embedding continues even if audit insert fails.
  const { error: docInsertErr } = await svc
    .from('client_knowledge_docs')
    .insert({
      client_id: clientId,
      filename: title,
      content_text: contentText,
      char_count: contentText.length,
    })

  if (docInsertErr) {
    console.error('[ingest-text] doc record insert failed:', docInsertErr)
  }

  // ── Embed ─────────────────────────────────────────────────────────────────────
  try {
    await embedChunks(clientId, chunks, `manual-text-${Date.now()}`)
    console.log(`[ingest-text] title="${title}" chunks=${chunks.length} client=${client.slug}${truncated ? ' (truncated)' : ''}`)
  } catch (err) {
    console.error('[ingest-text] Embedding failed:', err)
    return NextResponse.json({ error: 'Failed to embed content' }, { status: 500 })
  }

  // ── Sync agent tools ──────────────────────────────────────────────────────────
  try {
    await syncClientTools(svc, clientId)
  } catch (err) {
    console.error('[ingest-text] tools sync failed:', err)
  }

  return NextResponse.json({
    ok: true,
    title,
    charCount: contentText.length,
    chunksCreated: chunks.length,
    truncated,
  })
}
