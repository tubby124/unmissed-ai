/**
 * POST /api/dashboard/knowledge/upload-preview
 *
 * Extract and preview chunks from an uploaded file WITHOUT writing to the DB.
 * Returns detected content type + chunk list so the UI can show a review gate
 * before the user commits to embedding.
 *
 * Auth: admin or owner (same as /upload).
 * Max file size: 5MB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  extractText,
  splitIntoChunks,
  truncateText,
  detectContentType,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
} from '@/lib/knowledge-upload'

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

  // Scope check: owners can only preview their own client
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Validate file ───────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, TXT, DOCX, CSV, MD' }, { status: 400 })
  }

  // ── Extract + split (no DB writes) ─────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let chunks: string[]
  let charCount: number
  let truncated: boolean

  try {
    const raw = await extractText(buffer, file.name, file.type)
    const result = truncateText(raw)
    charCount = result.truncated ? result.originalLength : raw.length
    truncated = result.truncated
    chunks = splitIntoChunks(result.text)
  } catch (err) {
    console.error('[upload-preview] extraction failed:', err)
    return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
  }

  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No usable content found in file' }, { status: 422 })
  }

  const contentType = detectContentType(chunks, file.name)

  return NextResponse.json({
    filename: file.name,
    charCount,
    truncated,
    chunkCount: chunks.length,
    contentType,
    // Return up to 50 chunks for preview; actual embed uses all of them
    chunks: chunks.slice(0, 50),
    hasMore: chunks.length > 50,
  })
}
