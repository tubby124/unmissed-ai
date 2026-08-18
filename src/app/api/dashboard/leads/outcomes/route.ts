import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveLoftyWritebackState } from '@/lib/lofty-writeback'
import { buildLoftyRecordUrl } from '@/lib/outcome-desk'

/**
 * GET /api/dashboard/leads/outcomes?client_id=<uuid>
 *
 * Operator call-result surface for a campaign. Returns one compact row per
 * campaign lead: call state/disposition, attempt count + next eligible time,
 * one-sentence summary, next action, Lofty writeback state, and (for
 * authorized operators) a recording listen path.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'
  const requestedClientId = req.nextUrl.searchParams.get('client_id')
  const clientId = isAdmin ? requestedClientId : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only operators (admin/owner) may listen to call recordings.
  const canListen = cu.role !== 'viewer'

  const { data: leads, error } = await supabase
    .from('campaign_leads')
    .select('id, client_id, phone, name, status, disposition, lead_status, call_count, last_called_at, scheduled_callback_at, lofty_lead_id, last_call_log_id, notes')
    .eq('client_id', clientId)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch the last call log for each lead so the desk can surface the
  // one-sentence summary, next action, and recording link without N+1 round
  // trips from the client.
  const callLogIds = [...new Set((leads ?? []).map(l => l.last_call_log_id).filter(Boolean))] as string[]
  const callLogMap = new Map<string, { ai_summary: string | null; next_steps: string | null; ultravox_call_id: string | null }>()
  if (callLogIds.length > 0) {
    const { data: logs } = await supabase
      .from('call_logs')
      .select('id, ai_summary, next_steps, ultravox_call_id')
      .in('id', callLogIds)
    for (const log of logs ?? []) callLogMap.set(log.id, log)
  }

  const rows = (leads ?? []).map(lead => {
    const log = lead.last_call_log_id ? callLogMap.get(lead.last_call_log_id) : undefined
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      disposition: lead.disposition,
      lead_status: lead.lead_status,
      call_count: lead.call_count ?? 0,
      last_called_at: lead.last_called_at,
      scheduled_callback_at: lead.scheduled_callback_at,
      lofty_lead_id: lead.lofty_lead_id,
      writeback_state: resolveLoftyWritebackState({ notes: lead.notes, loftyLeadId: lead.lofty_lead_id }),
      summary: log?.ai_summary ?? null,
      next_action: log?.next_steps ?? null,
      recording_url: log?.ultravox_call_id ? `/api/dashboard/calls/${log.ultravox_call_id}/recording` : null,
      lofty_record_url: buildLoftyRecordUrl(lead.lofty_lead_id),
    }
  })

  return NextResponse.json({ leads: rows, can_listen: canListen })
}
