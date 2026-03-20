import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

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

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id

  // Permission check
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const svc = createServiceClient()
  const { data: chunks, error } = await svc
    .from('knowledge_chunks')
    .select('id, content, chunk_type, source, status, trust_tier, hit_count, last_hit_at, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get client slug for filename
  const { data: client } = await svc
    .from('clients')
    .select('slug')
    .eq('id', clientId)
    .single()

  const slug = client?.slug ?? 'unknown'
  const filename = `${slug}-knowledge-export-${new Date().toISOString().slice(0, 10)}.json`

  const exportData = {
    client_id: clientId,
    slug,
    exported_at: new Date().toISOString(),
    total: chunks?.length ?? 0,
    chunks: (chunks ?? []).map(c => ({
      content: c.content,
      chunk_type: c.chunk_type,
      source: c.source,
      status: c.status,
      trust_tier: c.trust_tier,
      hit_count: c.hit_count,
      last_hit_at: c.last_hit_at,
      created_at: c.created_at,
    })),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
