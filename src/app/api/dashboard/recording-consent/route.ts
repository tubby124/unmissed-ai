/**
 * POST /api/dashboard/recording-consent
 *
 * Wave 1.5 — One-time legal acknowledgment for clients that predate the consent
 * migration. Sets clients.recording_consent_acknowledged_at = now().
 *
 * Important: does NOT auto-enable RECORDING_DISCLOSURE for grandfathered clients.
 * Their prompts stay untouched — they can opt-in to the in-call disclosure
 * separately via the settings card. This avoids triggering a prompt redeploy
 * on a live agent without explicit confirmation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({})) as { client_id?: string }
  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (cu.role !== 'admin' && clientId !== cu.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      recording_consent_acknowledged_at: new Date().toISOString(),
      recording_consent_version: 1,
    })
    .eq('id', clientId)

  if (updateErr) {
    console.error('[recording-consent] update failed:', updateErr)
    return NextResponse.json({ error: 'Failed to save acknowledgment' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, acknowledged_at: new Date().toISOString() })
}
