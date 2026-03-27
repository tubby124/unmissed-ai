/**
 * GET /api/admin/orphan-report
 *
 * Lists clients with missing critical resources:
 * - Active client without ultravox_agent_id
 * - Active client without twilio_number (non-trial)
 * - Active client without tools array
 * - Active client with stale sync status
 *
 * Admin only. Returns structured report for operator triage.
 */

import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  // Fetch all non-deleted clients with their critical resource fields
  const { data: clients, error } = await svc
    .from('clients')
    .select('id, slug, business_name, status, subscription_status, ultravox_agent_id, twilio_number, tools, last_agent_sync_status, last_agent_sync_at')
    .neq('status', 'deleted')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orphans: {
    slug: string
    business_name: string | null
    status: string
    issues: string[]
  }[] = []

  for (const c of clients ?? []) {
    const issues: string[] = []
    const isActive = c.status === 'active'
    const isTrial = (c.subscription_status as string) === 'trialing'

    if (isActive && !c.ultravox_agent_id) {
      issues.push('missing ultravox_agent_id')
    }
    if (isActive && !isTrial && !c.twilio_number) {
      issues.push('missing twilio_number (non-trial active client)')
    }
    if (isActive && (!c.tools || (Array.isArray(c.tools) && c.tools.length === 0))) {
      issues.push('empty tools array')
    }
    if (isActive && (c.last_agent_sync_status as string) === 'error') {
      issues.push(`last sync failed at ${c.last_agent_sync_at}`)
    }

    if (issues.length > 0) {
      orphans.push({
        slug: c.slug,
        business_name: c.business_name,
        status: c.status,
        issues,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    total_clients: (clients ?? []).length,
    orphan_count: orphans.length,
    orphans,
    checked_at: new Date().toISOString(),
  })
}
