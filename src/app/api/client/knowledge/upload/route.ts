/**
 * POST /api/client/knowledge/upload
 *
 * Accepts multipart FormData with a file + intake_id.
 * Extracts text from PDF/TXT/DOCX, stores in client_knowledge_docs table.
 * Max file size: 5MB. Text truncated to 4000 chars.
 *
 * Public — no auth (used during onboarding wizard).
 * Rate limit: 5 uploads/min/IP.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 1000 // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, timestamps)
  return timestamps.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_LENGTH = 4000
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'docx'])

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

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
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
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, DOCX' }, { status: 400 })
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

    recordUsage(ip)
    console.log(`[knowledge-upload] Stored ${file.name} (${charCount} chars) for intake=${intakeId}`)

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
