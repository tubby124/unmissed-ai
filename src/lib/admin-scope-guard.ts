import type { NextRequest } from 'next/server'
import { isAdminRedesignEnabled } from '@/lib/feature-flags'

// Phase 0.5.3 — Cross-client scope edit guard.
// When an admin scopes into another client's data, default mode = read-only.
// Writes require an explicit edit-mode signal:
//   - Header: x-admin-edit-mode: 1
//   - or body field: edit_mode_confirmed: true
//
// Gated behind ADMIN_REDESIGN_ENABLED so existing admin write paths (e.g. Knowledge
// page) are unaffected until the new banner UI ships the toggle in Phase 1.
//
// Plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)

export interface ScopeGuardArgs {
  role: string                          // current user's role from client_users
  ownClientId: string | null            // user's own client_users.client_id
  targetClientId: string                // resolved target_client_id for this write
  req: NextRequest                      // for header inspection
  body?: Record<string, unknown> | null // parsed body (may carry edit_mode_confirmed)
}

export interface ScopeGuardResult {
  allowed: boolean
  reason?: 'EDIT_MODE_REQUIRED' | 'NOT_CROSS_CLIENT' | 'NOT_ADMIN'
  isCrossClient: boolean
}

export function evaluateAdminScopeGuard(args: ScopeGuardArgs): ScopeGuardResult {
  const { role, ownClientId, targetClientId, req, body } = args

  const isCrossClient = role === 'admin' && !!ownClientId && targetClientId !== ownClientId

  // Non-admin or self-scope: not subject to the guard.
  if (!isCrossClient) {
    return { allowed: true, isCrossClient: false, reason: 'NOT_CROSS_CLIENT' }
  }

  // Feature flag off: behavior preserved as today (admin can write cross-client).
  if (!isAdminRedesignEnabled()) {
    return { allowed: true, isCrossClient: true }
  }

  const headerSignal = req.headers.get('x-admin-edit-mode')
  const bodySignal = body && typeof body === 'object' ? body['edit_mode_confirmed'] : undefined

  const editEnabled =
    headerSignal === '1' ||
    headerSignal === 'true' ||
    bodySignal === true ||
    bodySignal === 1 ||
    bodySignal === '1' ||
    bodySignal === 'true'

  if (!editEnabled) {
    return { allowed: false, isCrossClient: true, reason: 'EDIT_MODE_REQUIRED' }
  }

  return { allowed: true, isCrossClient: true }
}

export const EDIT_MODE_REQUIRED_RESPONSE = {
  error: 'EDIT_MODE_REQUIRED',
  message:
    'Admin acting on another client. Click "Enable edits" in the banner before retrying this write.',
}
