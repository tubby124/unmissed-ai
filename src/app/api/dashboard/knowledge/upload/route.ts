/**
 * POST /api/dashboard/knowledge/upload
 *
 * Authenticated file upload for dashboard Knowledge Base tab.
 * Accepts multipart FormData with a file + client_id.
 * Extracts text from PDF/TXT/DOCX/CSV, splits into chunks, embeds + stores
 * directly into knowledge_chunks (pgvector).
 *
 * Auth: admin or owner. Owners can only upload to their own client.
 * Max file size: 5MB. Text truncated to 4000 chars.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { embedChunks, type ChunkInput } from '@/lib/embeddings'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_TEXT_LENGTH = 4000
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
    const text = buffer.toString('utf-8')
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length <= 1) return text
    const dataLines = lines.slice(1).map(line => {
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
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

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
    contentText = await extractText(buffer, file.name, file.type)
  } catch (err) {
    console.error(`[knowledge-upload-dashboard] Text extraction failed for ${file.name}:`, err)
    return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
  }

  if (contentText.length > MAX_TEXT_LENGTH) {
    contentText = contentText.slice(0, MAX_TEXT_LENGTH)
  }

  // ── Split into chunks and embed ─────────────────────────────────────────────
  const paragraphs = contentText
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20)

  // If no paragraph breaks, split by single newlines
  const segments = paragraphs.length > 0
    ? paragraphs
    : contentText.split('\n').map(l => l.trim()).filter(l => l.length > 20)

  if (segments.length === 0) {
    return NextResponse.json({ error: 'No usable content found in file' }, { status: 422 })
  }

  const chunks: ChunkInput[] = segments.map(p => ({
    content: p,
    chunkType: 'document',
    source: 'knowledge_doc',
    status: 'approved',
    trustTier: 'high',
  }))

  try {
    const svc = createServiceClient()

    // Verify client exists
    const { data: client } = await svc
      .from('clients')
      .select('slug')
      .eq('id', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

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
