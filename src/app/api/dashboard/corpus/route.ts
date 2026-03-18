import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()
  if (!cu) return new NextResponse('No client found', { status: 404 })

  let targetClientId = cu.client_id
  const clientIdParam = req.nextUrl.searchParams.get('client_id')
  if (cu.role === 'admin' && clientIdParam) targetClientId = clientIdParam

  const { data: docs, error } = await supabase
    .from('client_knowledge_docs')
    .select('id, filename, file_size_bytes, mime_type, corpus_status, created_at')
    .eq('client_id', targetClientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[corpus] List query failed:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  return NextResponse.json(docs ?? [])
}
