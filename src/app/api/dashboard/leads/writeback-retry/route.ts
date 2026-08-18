import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { writeCompletedCallToLofty, resolveLoftyWritebackState } from '@/lib/lofty-writeback'
import { isHasanSharifRealEstateClient, isNumericSafeLoftyLeadId, REALTOR_LOFTY_REVIVAL_MODE } from '@/lib/realtor-outbound-prompt'

/**
 * POST /api/dashboard/leads/writeback-retry
 *
 * Re-attempts the Lofty writeback for a campaign lead whose previous writeback
 * failed (or is still pending). Reconstructs the minimal classification from
 * the lead's last call log and hands off to writeCompletedCallToLofty, which
 * is idempotent via the `Unmissed Call ID:` marker.
 *
 * Body: { id }  (campaign lead id)
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
  const body = await req.json().catch(() => ({})) as { id?: string }
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: lead } = await supabase
    .from('campaign_leads')
    .select('id, client_id, notes, lofty_lead_id, status, scheduled_callback_at, disposition, call_count')
    .eq('id', id)
    .limit(1)
    .maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!isAdmin && lead.client_id !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isNumericSafeLoftyLeadId(lead.lofty_lead_id)) {
    return NextResponse.json({ error: 'Lead has no numeric Lofty lead id' }, { status: 400 })
  }

  const writebackState = resolveLoftyWritebackState({ notes: lead.notes, loftyLeadId: lead.lofty_lead_id })
  if (writebackState === 'synced') {
    return NextResponse.json({ error: 'Already synced to Lofty' }, { status: 400 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, niche, business_name')
    .eq('id', lead.client_id)
    .limit(1)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!isHasanSharifRealEstateClient({ clientSlug: client.slug, clientNiche: client.niche })) {
    return NextResponse.json({ error: 'Lofty writeback applies only to Hasan real-estate Lofty leads' }, { status: 400 })
  }

  const { data: logs } = await supabase
    .from('call_logs')
    .select('id, ai_summary, next_steps, ultravox_call_id, ended_at, call_status')
    .eq('client_id', client.id)
    .eq('call_direction', 'outbound')
    .order('started_at', { ascending: false })
    .limit(1)
  const log = logs?.[0]
  if (!log || !log.ultravox_call_id) {
    return NextResponse.json({ error: 'No completed outbound call to retry' }, { status: 400 })
  }

  const result = await writeCompletedCallToLofty({
    supabase,
    client: { id: client.id, slug: client.slug, niche: client.niche, business_name: client.business_name },
    metadata: { call_mode: REALTOR_LOFTY_REVIVAL_MODE, lead_id: id },
    campaignLeadId: id,
    callLogId: log.id,
    callId: log.ultravox_call_id,
    endedAt: log.ended_at ?? new Date().toISOString(),
    classification: {
      status: log.call_status,
      summary: log.ai_summary,
      next_steps: log.next_steps,
    },
  })

  // Read back the freshly persisted notes to report the new server state.
  const { data: fresh } = await supabase
    .from('campaign_leads')
    .select('notes, lofty_lead_id')
    .eq('id', id)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    ok: result.ok,
    result,
    lead: {
      id,
      writeback_state: resolveLoftyWritebackState({ notes: fresh?.notes ?? null, loftyLeadId: lead.lofty_lead_id }),
    },
  })
}
