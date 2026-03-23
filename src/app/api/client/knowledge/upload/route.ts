/**
 * POST /api/client/knowledge/upload
 *
 * Accepts multipart FormData with a file + intake_id.
 * Extracts text from PDF/TXT/DOCX/CSV, stores in client_knowledge_docs table.
 * Seeds extracted content into knowledge_chunks (pgvector) when client_id is available.
 * Max file size: 5MB. Text truncated to 4000 chars.
 *
 * Public — no auth (used during onboarding wizard).
 * Rate limit: 5 uploads/min/IP.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

// 5 uploads per IP per minute (S13x: shared limiter replaces inline Map)
const perIpLimiter = new SlidingWindowRateLimiter(5, 60 * 1000)

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_LENGTH = 4000
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.ms-excel', // some systems send CSV as this
])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'docx', 'csv'])

async function extractText(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'txt' || mimeType === 'text/plain') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
    // Parse CSV: skip header row, join remaining rows as fact lines
    const text = buffer.toString('utf-8')
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length <= 1) return text // just header or single line
    // Skip header, join cell values per row with " | "
    const dataLines = lines.slice(1).map(line => {
      // Simple CSV parse — handle quoted fields
      return line.replace(/"/g, '').split(',').map(c => c.trim()).filter(c => c).join(' | ')
    })
    return dataLines.join('\n')
  }

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

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
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, DOCX, CSV' }, { status: 400 })
    }

    // Validate intake exists
    const { data: intake, error: intakeErr } = await adminSupa
      .from('intake_submissions')
      .select('id')
      .eq('id', intakeId)
      .single()

    if (intakeErr || !intake) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    // Extract text from file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let contentText: string
    try {
      contentText = await extractText(buffer, file.name, file.type)
    } catch (err) {
      console.error(`[knowledge-upload] Text extraction failed for ${file.name}:`, err)
      return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
    }

    // Truncate to max length
    if (contentText.length > MAX_TEXT_LENGTH) {
      contentText = contentText.slice(0, MAX_TEXT_LENGTH)
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
        const paragraphs = contentText
          .split(/\n\n+|\n/)
          .map(p => p.trim())
          .filter(p => p.length > 20)

        const chunks = paragraphs.map(p => ({
          content: p,
          chunkType: 'page_content' as const,
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
