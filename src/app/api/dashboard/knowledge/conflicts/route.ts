/**
 * GET  /api/dashboard/knowledge/conflicts
 * PATCH /api/dashboard/knowledge/conflicts
 *
 * GET  — Returns unresolved conflict_flag items from compiler_runs for the client.
 *        Response: { conflicts: Array<{ run_id, content, review_reason, created_at }> }
 *
 * PATCH — Marks all conflicts for the client as dismissed (conflicts_dismissed=true).
 *         Body: { run_ids: string[] }
 *         Response: { ok: true }
 *
 * Auth: admin or owner.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Admin can query for a specific client via ?client_id=…
  const clientIdParam = req.nextUrl.searchParams.get('client_id')
  const clientId = cu.role === 'admin' && clientIdParam ? clientIdParam : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  const svc = createServiceClient()

  // Fetch compiler_runs that have non-empty conflicts and haven't been dismissed
  const { data: runs, error } = await svc
    .from('compiler_runs')
    .select('id, conflicts, created_at')
    .eq('client_id', clientId)
    .eq('conflicts_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[knowledge/conflicts] fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 })
  }

  // Flatten: one entry per conflict item, tagged with the run_id
  type ConflictItem = { content: string; review_reason?: string }
  const conflicts: Array<{ run_id: string; content: string; review_reason: string; created_at: string }> = []

  for (const run of runs ?? []) {
    const items = Array.isArray(run.conflicts) ? (run.conflicts as ConflictItem[]) : []
    for (const item of items) {
      if (item.content?.trim()) {
        conflicts.push({
          run_id: run.id as string,
          content: item.content.trim(),
          review_reason: item.review_reason?.trim() ?? '',
          created_at: run.created_at as string,
        })
      }
    }
  }

  return NextResponse.json({ conflicts })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { run_ids?: string[] }
  const runIds = body.run_ids ?? []
  if (runIds.length === 0) return NextResponse.json({ ok: true })

  const clientIdParam = req.nextUrl.searchParams.get('client_id')
  const clientId = cu.role === 'admin' && clientIdParam ? clientIdParam : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  const svc = createServiceClient()

  const { error } = await svc
    .from('compiler_runs')
    .update({ conflicts_dismissed: true })
    .in('id', runIds)
    .eq('client_id', clientId) // scope to this client for safety

  if (error) {
    console.error('[knowledge/conflicts] dismiss error:', error)
    return NextResponse.json({ error: 'Failed to dismiss conflicts' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
