import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/epub+zip': 'epub',
}

export async function POST(req: NextRequest) {
  const corpusId = process.env.ULTRAVOX_CORPUS_ID
  if (!corpusId) {
    return NextResponse.json({ error: 'Knowledge base not configured' }, { status: 503 })
  }

  const uvKey = process.env.ULTRAVOX_API_KEY
  if (!uvKey) {
    return NextResponse.json({ error: 'Ultravox API not configured' }, { status: 503 })
  }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()
  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({}))

  let targetClientId = cu.client_id
  if (cu.role === 'admin' && body.client_id) targetClientId = body.client_id

  const { filename, mimeType, fileSize } = body as {
    filename?: string
    mimeType?: string
    fileSize?: number
  }

  if (!filename || typeof filename !== 'string') {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }
  if (!mimeType || typeof mimeType !== 'string') {
    return NextResponse.json({ error: 'mimeType is required' }, { status: 400 })
  }
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    return NextResponse.json({ error: 'fileSize must be a positive number' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES[mimeType]) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${Object.values(ALLOWED_MIME_TYPES).join(', ')}` },
      { status: 400 }
    )
  }

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  try {
    const uploadRes = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/uploads`, {
      method: 'POST',
      headers: {
        'X-API-Key': uvKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mimeType }),
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => 'Unknown error')
      console.error(`[corpus/upload] Ultravox upload request failed: ${uploadRes.status} ${errText}`)
      return NextResponse.json({ error: 'Failed to create upload session' }, { status: 502 })
    }

    const uploadData = (await uploadRes.json()) as { uploadUrl: string; documentId: string }

    const { data: doc, error: insertErr } = await supabase
      .from('client_knowledge_docs')
      .insert({
        client_id: targetClientId,
        filename,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        corpus_document_id: uploadData.documentId,
        corpus_status: 'uploading',
      })
      .select('id')
      .single()

    if (insertErr || !doc) {
      console.error('[corpus/upload] DB insert failed:', insertErr)
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
    }

    console.log(`[corpus/upload] Created upload for ${filename} (${fileSize} bytes) client=${targetClientId} docId=${doc.id}`)

    return NextResponse.json({
      uploadUrl: uploadData.uploadUrl,
      documentId: uploadData.documentId,
      docId: doc.id,
    })
  } catch (err) {
    console.error('[corpus/upload] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
