import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

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

  let body: { id?: string; action?: string; client_id?: string; edit_mode_confirmed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

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

  // Owners can only affect their own suggestions; admin's targetClientId honors
  // the switcher selection so a cross-client dismiss lands on the right row.
  const targetForFilter = scope.role === 'admin' ? scope.targetClientId : scope.ownClientId
  const { error } = await supabase
    .from('prompt_improvement_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('client_id', targetForFilter as string)
    .eq('status', 'pending')

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/prompt-suggestions',
        method: 'POST',
        payload: { suggestion_id: id, action },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: 'Failed to dismiss suggestion' }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/prompt-suggestions',
      method: 'POST',
      payload: { suggestion_id: id, action },
    })
  }

  return NextResponse.json({ ok: true })
}
