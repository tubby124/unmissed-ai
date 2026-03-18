import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

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

  const { docId, documentId } = body as { docId?: string; documentId?: string }

  if (!docId || typeof docId !== 'string') {
    return NextResponse.json({ error: 'docId is required' }, { status: 400 })
  }
  if (!documentId || typeof documentId !== 'string') {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
  }

  const { data: doc, error: docErr } = await supabase
    .from('client_knowledge_docs')
    .select('id, filename, client_id')
    .eq('id', docId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.client_id !== targetClientId) {
    return NextResponse.json({ error: 'Document does not belong to this client' }, { status: 403 })
  }

  try {
    const { data: client } = await supabase
      .from('clients')
      .select('slug')
      .eq('id', targetClientId)
      .single()

    const sourceName = `client-${client?.slug ?? 'unknown'}-${doc.filename}`

    const sourceRes = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/sources`, {
      method: 'POST',
      headers: {
        'X-API-Key': uvKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentIds: [documentId],
        name: sourceName,
      }),
    })

    if (!sourceRes.ok) {
      const errText = await sourceRes.text().catch(() => 'Unknown error')
      console.error(`[corpus/confirm] Ultravox source creation failed: ${sourceRes.status} ${errText}`)
      return NextResponse.json({ error: 'Failed to create corpus source' }, { status: 502 })
    }

    const sourceData = (await sourceRes.json()) as { sourceId: string }

    const { error: updateErr } = await supabase
      .from('client_knowledge_docs')
      .update({
        corpus_source_id: sourceData.sourceId,
        corpus_status: 'indexed',
      })
      .eq('id', docId)

    if (updateErr) {
      console.error('[corpus/confirm] DB update failed:', updateErr)
      return NextResponse.json({ error: 'Source created but failed to update record' }, { status: 500 })
    }

    console.log(`[corpus/confirm] Source created for ${doc.filename} sourceId=${sourceData.sourceId} client=${targetClientId}`)

    return NextResponse.json({ success: true, sourceId: sourceData.sourceId })
  } catch (err) {
    console.error('[corpus/confirm] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
