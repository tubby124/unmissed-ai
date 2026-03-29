/**
 * PATCH /api/dashboard/leads/follow-up
 * Updates follow_up_status on a HOT/WARM call_log row for the authenticated client.
 * Body: { callLogId: string, status: 'contacted' | 'booked' | 'dead' | null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['contacted', 'booked', 'dead', null] as const
type FollowUpStatus = typeof VALID_STATUSES[number]

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const body = await req.json() as { callLogId?: string; status?: unknown }
  const { callLogId, status } = body

  if (!callLogId || typeof callLogId !== 'string') {
    return NextResponse.json({ error: 'callLogId required' }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(status as FollowUpStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Only allow updating rows that belong to the user's client
  const { error } = await supabase
    .from('call_logs')
    .update({ follow_up_status: status as FollowUpStatus })
    .eq('id', callLogId)
    .eq('client_id', cu.client_id)

  if (error) {
    console.error('[leads/follow-up] Update failed:', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
