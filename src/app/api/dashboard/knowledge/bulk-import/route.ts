import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'
import { syncClientTools } from '@/lib/sync-client-tools'

const MAX_CHUNKS = 100
const MAX_CONTENT_LENGTH = 5000

interface BulkChunk {
  content: string
  chunk_type?: string
  trust_tier?: string
  source?: string
}

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
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    chunks?: BulkChunk[]
    auto_approve?: boolean
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  const chunks = body.chunks

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return NextResponse.json({ error: 'chunks array is required' }, { status: 400 })
  }
  if (chunks.length > MAX_CHUNKS) {
    return NextResponse.json({ error: `Maximum ${MAX_CHUNKS} chunks per import` }, { status: 400 })
  }

  // Permission check
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Validate all chunks before processing
  const errors: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    if (!c.content?.trim()) {
      errors.push(`Chunk ${i + 1}: content is required`)
    } else if (c.content.length > MAX_CONTENT_LENGTH) {
      errors.push(`Chunk ${i + 1}: content exceeds ${MAX_CONTENT_LENGTH} chars`)
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
  }

  const canAutoApprove = cu.role === 'admin' || cu.role === 'owner'
  const status = body.auto_approve && canAutoApprove ? 'approved' : 'pending'
  const runId = `bulk-import-${Date.now()}`

  // Embed all chunks in parallel (batches of 10 to avoid rate limits)
  const results: { index: number; ok: boolean; error?: string }[] = []
  const svc = createServiceClient()
  const BATCH_SIZE = 10

  for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
    const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (chunk, batchIdx) => {
        const idx = batchStart + batchIdx
        const content = chunk.content.trim()
        const embedding = await embedText(content)
        if (!embedding) {
          throw new Error('Embedding generation failed')
        }

        const { error: insertErr } = await svc
          .from('knowledge_chunks')
          .insert({
            client_id: clientId,
            content,
            chunk_type: chunk.chunk_type ?? 'manual',
            trust_tier: chunk.trust_tier ?? 'medium',
            source: chunk.source ?? 'bulk_import',
            status,
            embedding: JSON.stringify(embedding),
            metadata: { added_by: user.id, bulk_import: true },
            source_run_id: runId,
          })

        if (insertErr) throw new Error(insertErr.message)
        return idx
      })
    )

    for (let i = 0; i < batchResults.length; i++) {
      const r = batchResults[i]
      const idx = batchStart + i
      if (r.status === 'fulfilled') {
        results.push({ index: idx, ok: true })
      } else {
        results.push({ index: idx, ok: false, error: r.reason?.message ?? 'Unknown error' })
      }
    }
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  console.log(`[knowledge/bulk-import] clientId=${clientId} total=${chunks.length} succeeded=${succeeded} failed=${failed} runId=${runId}`)

  // S5: if any chunks were auto-approved, rebuild clients.tools
  // S7e: awaited (fire-and-forget not safe in Next.js route handlers)
  if (status === 'approved' && succeeded > 0) {
    try { await syncClientTools(svc, clientId) } catch (err) {
      console.error(`[knowledge/bulk-import] tools sync failed: ${err}`)
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    total: chunks.length,
    succeeded,
    failed,
    run_id: runId,
    errors: results.filter(r => !r.ok),
  })
}

