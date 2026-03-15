/**
 * GET  /api/dashboard/lab-transcripts?clientId=xxx — returns recent sessions (max 20)
 * POST /api/dashboard/lab-transcripts — saves a transcript
 *      Body: { clientId: string, transcriptJson: object, promptSnapshot?: string }
 * Admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: cu } = await supabase.from('client_users').select('role').eq('user_id', user.id).single()
  if (cu?.role !== 'admin') return null
  return user
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('lab_transcripts')
    .select('id, created_at, transcript_json, prompt_snapshot')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    clientId?: string
    transcriptJson?: object
    promptSnapshot?: string
  }
  const { clientId, transcriptJson, promptSnapshot } = body
  if (!clientId || !transcriptJson) {
    return NextResponse.json({ error: 'clientId and transcriptJson required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('lab_transcripts')
    .insert({
      client_id: clientId,
      transcript_json: transcriptJson,
      prompt_snapshot: promptSnapshot ?? null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
