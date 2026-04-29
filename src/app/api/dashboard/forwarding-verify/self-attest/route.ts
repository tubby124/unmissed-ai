import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export const maxDuration = 10

/**
 * Go Live Tab Section 4 — "I've already forwarded this number — mark it done".
 *
 * Returning users who already configured carrier forwarding shouldn't have to
 * re-trigger a real verification call every visit. This sets
 * forwarding_verified_at + forwarding_self_attested=true so the GoLiveProgress
 * 4-condition check counts the section as done.
 *
 * Phase 3 Wave B: when an admin scopes into another client and self-attests,
 * the cross-client edit guard + audit log apply.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  }
  const { scope } = resolved
  if (scope.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const FIELD_KEYS = ['forwarding_verified_at', 'forwarding_self_attested'] as const

  const svc = createServiceClient()

  // Snapshot before-row when an admin is acting on another client (audit diff).
  let beforeRow: Record<string, unknown> | null = null
  if (scope.guard.isCrossClient) {
    const { data } = await svc
      .from('clients')
      .select(FIELD_KEYS.join(','))
      .eq('id', scope.targetClientId)
      .maybeSingle()
    beforeRow = (data as unknown as Record<string, unknown>) ?? null
  }

  const nowIso = new Date().toISOString()
  const updates = {
    forwarding_verified_at: nowIso,
    forwarding_self_attested: true,
  }

  const { error } = await svc
    .from('clients')
    .update(updates)
    .eq('id', scope.targetClientId)

  if (error) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/forwarding-verify/self-attest',
      method: 'POST',
      payload: updates,
      status: 'error',
      errorMessage: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/forwarding-verify/self-attest',
      method: 'POST',
      payload: updates,
      beforeRow,
      afterRow: updates as Record<string, unknown>,
      fieldKeys: FIELD_KEYS,
    })
  }

  return NextResponse.json({ ok: true, verified_at: nowIso })
}
