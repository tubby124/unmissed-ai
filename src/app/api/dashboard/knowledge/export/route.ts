import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const params = req.nextUrl.searchParams
  const clientId = cu.role === 'admin' && params.get('client_id')
    ? params.get('client_id')!
    : cu.client_id

  // Permission check
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const format = params.get('format') ?? 'json'

  const svc = createServiceClient()

  if (format === 'csv') {
    // CSV export — approved chunks only, columns: source, kind, trust_tier, content
    const { data: chunks, error } = await svc
      .from('knowledge_chunks')
      .select('source, chunk_type, trust_tier, content')
      .eq('client_id', clientId)
      .eq('status', 'approved')
      .order('source')
      .order('chunk_type')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: client } = await svc
      .from('clients')
      .select('slug')
      .eq('id', clientId)
      .single()

    const slug = client?.slug ?? 'unknown'
    const filename = `${slug}-knowledge-${new Date().toISOString().slice(0, 10)}.csv`

    const rows = ['source,kind,trust_tier,content']
    for (const c of chunks ?? []) {
      rows.push([
        escapeCSV(c.source ?? ''),
        escapeCSV(c.chunk_type ?? ''),
        escapeCSV(c.trust_tier ?? ''),
        escapeCSV(c.content ?? ''),
      ].join(','))
    }
    const csv = rows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // Default: JSON export (all chunks, all statuses) — existing behaviour unchanged
  const { data: chunks, error } = await svc
    .from('knowledge_chunks')
    .select('id, content, chunk_type, source, status, trust_tier, hit_count, last_hit_at, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
