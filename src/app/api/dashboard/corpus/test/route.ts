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

  if (cu.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { query, maxResults } = body as { query?: string; maxResults?: number }

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  try {
    const queryRes = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/query`, {
      method: 'POST',
      headers: {
        'X-API-Key': uvKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        maxResults: typeof maxResults === 'number' ? Math.min(maxResults, 20) : 5,
        minimumScore: 0.5,
      }),
    })

    if (!queryRes.ok) {
      const errText = await queryRes.text().catch(() => 'Unknown error')
      console.error(`[corpus/test] Ultravox query failed: ${queryRes.status} ${errText}`)
      return NextResponse.json({ error: 'Corpus query failed' }, { status: 502 })
    }

    const results = await queryRes.json()
    return NextResponse.json(results)
  } catch (err) {
    console.error('[corpus/test] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
