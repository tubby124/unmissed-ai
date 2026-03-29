import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  const isAdmin = cu.role === 'admin'
  const { searchParams } = new URL(req.url)
  const filterClientId = isAdmin
    ? searchParams.get('client_id') || cu.client_id
    : cu.client_id

  const { data: suggestions, error } = await supabase
    .from('prompt_improvement_suggestions')
    .select('id, section_id, trigger_type, suggestion_text, call_log_ids, evidence_count, status, created_at')
    .eq('client_id', filterClientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })

  return NextResponse.json({ suggestions: suggestions ?? [], total: (suggestions ?? []).length })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  let body: { id?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, action } = body

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  if (action === 'apply') {
    return NextResponse.json(
      { error: 'Apply flow ships in the next slice. Use the Prompt Editor to apply manually.' },
      { status: 501 }
    )
  }

  if (action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "dismiss"' }, { status: 400 })
  }

  const { error } = await supabase
    .from('prompt_improvement_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('client_id', cu.client_id)  // RLS safety belt: owner can only affect own suggestions
    .eq('status', 'pending')         // Only dismiss pending suggestions

  if (error) return NextResponse.json({ error: 'Failed to dismiss suggestion' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
