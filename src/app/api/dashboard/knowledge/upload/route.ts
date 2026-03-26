/**
 * POST /api/dashboard/knowledge/upload
 *
 * Authenticated file upload for dashboard Knowledge Base tab.
 * Accepts multipart FormData with a file + client_id.
 * Extracts text from PDF/TXT/DOCX/CSV, stores audit record in
 * client_knowledge_docs, splits into chunks, embeds into knowledge_chunks.
 *
 * Auth: admin or owner. Owners can only upload to their own client.
 * Max file size: 5MB. Text capped at 50K chars.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, type ChunkInput } from '@/lib/embeddings'
import {
  extractText,
  splitIntoChunks,
  truncateText,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
} from '@/lib/knowledge-upload'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Parse FormData ──────────────────────────────────────────────────────────
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const clientId = (formData.get('client_id') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  // Scope check: owners can only upload to their own client
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Validate file ───────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, DOCX, CSV' }, { status: 400 })
  }

  // ── Extract text ────────────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let contentText: string
  try {
    const raw = await extractText(buffer, file.name, file.type)
    const result = truncateText(raw)
    contentText = result.text
    if (result.truncated) {
      console.warn(`[knowledge-upload-dashboard] ${file.name} truncated: ${result.originalLength} → ${contentText.length} chars`)
    }
  } catch (err) {
    console.error(`[knowledge-upload-dashboard] Text extraction failed for ${file.name}:`, err)
    return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
  }

  // ── Split into chunks ─────────────────────────────────────────────────────
  const segments = splitIntoChunks(contentText)

  if (segments.length === 0) {
    return NextResponse.json({ error: 'No usable content found in file' }, { status: 422 })
  }

  const chunks: ChunkInput[] = segments.map(p => ({
    content: p,
    chunkType: 'document',
    source: 'knowledge_doc',
    status: 'pending',
    trustTier: 'high',
  }))

  try {
    const svc = createServiceClient()

    // Verify client exists + fetch plan for source limits
    const { data: client } = await svc
      .from('clients')
      .select('slug, selected_plan, subscription_status')
      .eq('id', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Phase 4.5 GAP-B: Enforce plan-based knowledge source limits
    const uploadPlan = getPlanEntitlements(
      (client.subscription_status as string | null) === 'trialing' ? 'trial' : (client.selected_plan as string | null)
    )
    if (!uploadPlan.fileUploadEnabled) {
      return NextResponse.json({ error: 'File upload is not available on your current plan.' }, { status: 403 })
    }
    const { count: sourceCount } = await svc
      .from('client_knowledge_docs')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
    if ((sourceCount ?? 0) >= uploadPlan.maxKnowledgeSources) {
      return NextResponse.json(
        { error: `Source limit reached for your plan (${sourceCount}/${uploadPlan.maxKnowledgeSources}). Upgrade to add more.` },
        { status: 403 },
      )
    }

    // ── Save audit record to client_knowledge_docs ──────────────────────────
    const { error: docInsertErr } = await svc
      .from('client_knowledge_docs')
      .insert({
        client_id: clientId,
        filename: file.name,
        content_text: contentText,
        char_count: contentText.length,
      })

    if (docInsertErr) {
      console.error('[knowledge-upload-dashboard] Doc record insert failed:', docInsertErr)
      // Non-fatal — continue with embedding even if audit record fails
    }

    // ── Embed chunks ──────────────────────────────────────────────────────────
    await embedChunks(clientId, chunks, `knowledge-doc-upload-${Date.now()}`)
    console.log(`[knowledge-upload-dashboard] ${file.name}: ${chunks.length} chunks embedded for client=${client.slug}`)

    return NextResponse.json({
      success: true,
      filename: file.name,
      charCount: contentText.length,
      chunksCreated: chunks.length,
    })
  } catch (err) {
    console.error('[knowledge-upload-dashboard] Embedding failed:', err)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
