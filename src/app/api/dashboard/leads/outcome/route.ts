import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { resolveLoftyWritebackState } from '@/lib/lofty-writeback'
import { MANUAL_OUTCOMES, SUPPRESSING_OUTCOMES } from '@/lib/outcome-desk'

const ACTIONS = ['approve_next', 'hold', 'manual_outcome', 'dnc'] as const
type OutcomeAction = typeof ACTIONS[number]

/**
 * POST /api/dashboard/leads/outcome
 *
 * Explicit operator controls for the Lofty campaign call outcome desk.
 * Body: { id, action, outcome? }
 *
 *   approve_next   — schedule this single lead for the next callback (not a
 *                    bulk dial: one lead, one explicit approval)
 *   hold           — clear the scheduled callback so the lead is no longer
 *                    eligible for the cron auto-dial
 *   manual_outcome — record a manual disposition (see MANUAL_OUTCOMES)
 *   dnc            — do-not-call suppression (status=dnc, closed)
 *
 * Every mutation returns the freshly read-back server row (no optimistic UI).
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu || cu.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'

  const body = await req.json().catch(() => ({})) as { id?: string; action?: string; outcome?: string }
  const { id, action, outcome } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (!action || !ACTIONS.includes(action as OutcomeAction)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
  }

  // Ownership gate for non-admin operators.
  if (!isAdmin) {
    const { data: lead } = await supabase
      .from('campaign_leads')
      .select('client_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
    if (!lead || lead.client_id !== cu.client_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = {}

  if (action === 'approve_next') {
    updates.scheduled_callback_at = new Date().toISOString()
    updates.status = 'queued'
  } else if (action === 'hold') {
    updates.scheduled_callback_at = null
  } else if (action === 'dnc') {
    updates.status = 'dnc'
    updates.disposition = 'do_not_call'
    updates.lead_status = 'closed'
    updates.scheduled_callback_at = null
  } else if (action === 'manual_outcome') {
    if (!outcome || !(MANUAL_OUTCOMES as readonly string[]).includes(outcome)) {
      return NextResponse.json({ error: 'outcome is required and must be a valid disposition' }, { status: 400 })
    }
    updates.disposition = outcome
    if ((SUPPRESSING_OUTCOMES as readonly string[]).includes(outcome)) {
      updates.status = 'dnc'
      updates.lead_status = 'closed'
      updates.scheduled_callback_at = null
    }
  }

  const { data: rows, error } = await supabase
    .from('campaign_leads')
    .update(updates)
    .eq('id', id)
    .select('id, phone, name, status, disposition, lead_status, call_count, last_called_at, scheduled_callback_at, lofty_lead_id, notes')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const lead = rows?.[0]
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  return NextResponse.json({
    ok: true,
    lead: {
      id: lead.id,
      status: lead.status,
      disposition: lead.disposition,
      lead_status: lead.lead_status,
      call_count: lead.call_count ?? 0,
      last_called_at: lead.last_called_at,
      scheduled_callback_at: lead.scheduled_callback_at,
      lofty_lead_id: lead.lofty_lead_id,
      writeback_state: resolveLoftyWritebackState({ notes: lead.notes, loftyLeadId: lead.lofty_lead_id }),
    },
  })
}
