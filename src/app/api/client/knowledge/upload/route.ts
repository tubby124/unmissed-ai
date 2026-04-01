/**
 * POST /api/client/knowledge/upload
 *
 * Accepts multipart FormData with a file + intake_id.
 * Extracts text from PDF/TXT/DOCX/CSV, stores in client_knowledge_docs table.
 * Seeds extracted content into knowledge_chunks (pgvector) when client_id is available.
 * Max file size: 5MB. Text capped at 50K chars.
 *
 * Public — no auth (used during onboarding wizard).
 * Rate limit: 5 uploads/min/IP.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import {
  extractText,
  splitIntoChunks,
  truncateText,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
} from '@/lib/knowledge-upload'

// 5 uploads per IP per minute (S13x: shared limiter replaces inline Map)
const perIpLimiter = new SlidingWindowRateLimiter(5, 60 * 1000)

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.ms-excel', // some systems send CSV as this
])

export async function POST(req: NextRequest) {
  const adminSupa = createServiceClient()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'

  const ipCheck = perIpLimiter.check(ip)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const intakeId = formData.get('intake_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!intakeId) {
      return NextResponse.json({ error: 'intake_id is required' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    // Validate file type by extension and MIME
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, DOCX, CSV, MD' }, { status: 400 })
    }

    // Ensure intake row exists — upsert a draft if missing (handles create-draft failures gracefully)
    const { data: intake } = await adminSupa
      .from('intake_submissions')
      .select('id')
      .eq('id', intakeId)
      .single()

    if (!intake) {
      const { error: upsertErr } = await adminSupa
        .from('intake_submissions')
        .upsert({
          id: intakeId,
          business_name: 'Draft',
          niche: 'other',
          status: 'draft',
          progress_status: 'draft',
          intake_json: {},
        }, { onConflict: 'id' })

      if (upsertErr) {
        console.error('[knowledge-upload] Failed to auto-create draft intake:', upsertErr.code, upsertErr.message)
        return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
      }
    }

    // Extract text from file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let contentText: string
    try {
      const raw = await extractText(buffer, file.name, file.type)
      const result = truncateText(raw)
      contentText = result.text
      if (result.truncated) {
        console.warn(`[knowledge-upload] ${file.name} truncated: ${result.originalLength} → ${contentText.length} chars`)
      }
    } catch (err) {
      console.error(`[knowledge-upload] Text extraction failed for ${file.name}:`, err)
      return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
    }

    const charCount = contentText.length

    // Insert into client_knowledge_docs
    const { data: doc, error: insertErr } = await adminSupa
      .from('client_knowledge_docs')
      .insert({
        intake_id: intakeId,
        filename: file.name,
        content_text: contentText,
        char_count: charCount,
      })
      .select('id, filename, char_count')
      .single()

    if (insertErr || !doc) {
      console.error('[knowledge-upload] Insert failed:', insertErr)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    perIpLimiter.record(ip)
    console.log(`[knowledge-upload] Stored ${file.name} (${charCount} chars) for intake=${intakeId}`)

    // Seed into knowledge_chunks for pgvector retrieval
    try {
      const { data: intakeRow } = await adminSupa
        .from('intake_submissions')
        .select('client_id')
        .eq('id', intakeId)
        .single()

      if (intakeRow?.client_id) {
        const { embedChunks } = await import('@/lib/embeddings')
        const segments = splitIntoChunks(contentText)

        const chunks = segments.map(p => ({
          content: p,
          chunkType: 'document' as const,
          source: 'knowledge_doc',
          status: 'approved',
          trustTier: 'high',
        }))

        if (chunks.length > 0) {
          await embedChunks(intakeRow.client_id, chunks, `knowledge-doc-${doc.id}`)
          console.log(`[knowledge-upload] Seeded ${chunks.length} chunks for client=${intakeRow.client_id}`)
        }
      }
      // If no client_id yet (during initial onboarding), chunks will be seeded
      // when generate-prompt runs and processes knowledge docs
    } catch (seedErr) {
      // Non-fatal — doc is saved, chunks can be seeded later during provisioning
      console.error('[knowledge-upload] Chunk seeding failed (non-fatal):', seedErr)
    }

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      charCount: doc.char_count,
    })
  } catch (err) {
    console.error('[knowledge-upload] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
