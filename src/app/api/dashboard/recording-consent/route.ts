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
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as { client_id?: string; edit_mode_confirmed?: boolean }

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (!['admin', 'owner'].includes(scope.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const clientId = scope.targetClientId
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const svc = createServiceClient()
  const acknowledgedAt = new Date().toISOString()
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      recording_consent_acknowledged_at: acknowledgedAt,
      recording_consent_version: 1,
    })
    .eq('id', clientId)

  if (updateErr) {
    console.error('[recording-consent] update failed:', updateErr)
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/recording-consent',
        method: 'POST',
        payload: { client_id: clientId },
        status: 'error',
        errorMessage: updateErr.message,
      })
    }
    return NextResponse.json({ error: 'Failed to save acknowledgment' }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/recording-consent',
      method: 'POST',
      payload: { client_id: clientId, acknowledged_at: acknowledgedAt },
    })
  }

  return NextResponse.json({ ok: true, acknowledged_at: acknowledgedAt })
}
