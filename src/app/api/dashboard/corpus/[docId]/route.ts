import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params

  const corpusId = process.env.ULTRAVOX_CORPUS_ID
  const uvKey = process.env.ULTRAVOX_API_KEY

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

  const { data: doc, error: docErr } = await supabase
    .from('client_knowledge_docs')
    .select('id, client_id, corpus_source_id, filename')
    .eq('id', docId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.client_id !== targetClientId) {
    return NextResponse.json({ error: 'Document does not belong to this client' }, { status: 403 })
  }

  if (doc.corpus_source_id && corpusId && uvKey) {
    try {
      const delRes = await fetch(
        `${ULTRAVOX_BASE}/corpora/${corpusId}/sources/${doc.corpus_source_id}`,
        {
          method: 'DELETE',
          headers: { 'X-API-Key': uvKey },
        }
      )
      if (!delRes.ok && delRes.status !== 404) {
        const errText = await delRes.text().catch(() => 'Unknown error')
        console.error(`[corpus/delete] Ultravox source delete failed: ${delRes.status} ${errText}`)
      }
    } catch (err) {
      console.error(`[corpus/delete] Ultravox source delete error:`, err)
    }
  }

  const { error: deleteErr } = await supabase
    .from('client_knowledge_docs')
    .delete()
    .eq('id', docId)

  if (deleteErr) {
    console.error('[corpus/delete] DB delete failed:', deleteErr)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  console.log(`[corpus/delete] Deleted ${doc.filename} (id=${docId}) client=${targetClientId}`)

  return NextResponse.json({ success: true })
}
