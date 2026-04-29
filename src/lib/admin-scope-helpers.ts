// Phase 0.5 / Phase 3 Wave B — Shared helpers for admin cross-client write surfaces.
//
// Every dashboard write route that accepts a `client_id` admin override must:
//   1. resolve the target client (own row vs admin override)
//   2. evaluate `evaluateAdminScopeGuard()` and 403 when edit-mode isn't confirmed
//   3. record an admin_audit_log row when the guard fired (acting on another client)
//
// The Settings PATCH route (`src/app/api/dashboard/settings/route.ts`) was the
// reference implementation. This file lifts that pattern to a single helper so
// every Wave B route gains the same protection without inlining ~30 lines each.
//
// Plan: ../../Downloads/Obsidian Vault/Projects/unmissed/2026-04-28-admin-dashboard-redesign-plan.md
// Cold-start: NEXT-CHAT-Admin-Redesign-Phase-3-Wave-B.md

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateAdminScopeGuard,
  EDIT_MODE_REQUIRED_RESPONSE,
  type ScopeGuardResult,
} from '@/lib/admin-scope-guard'
import { recordAdminAudit, diffFields } from '@/lib/admin-audit'

export interface ResolvedAdminScope {
  /** Authenticated user. */
  user: { id: string }
  /** client_users.role for this user. */
  role: string
  /** client_users.client_id for this user (null only for admin without primary client). */
  ownClientId: string | null
  /** Resolved write target — admin override or fallback to ownClientId. */
  targetClientId: string
  /** Result of evaluateAdminScopeGuard() — `allowed=false` means caller must 403. */
  guard: ScopeGuardResult
}

export interface ResolveAdminScopeArgs {
  supabase: SupabaseClient
  req: NextRequest
  /** Body fragment (already parsed) — looked up for `client_id` and `edit_mode_confirmed`. */
  body?: Record<string, unknown> | null
  /** Optional override client_id when reading from query string instead of body. */
  queryClientId?: string | null
  /** When true, the helper accepts a `clientId` (camelCase) field too. Some legacy routes use it. */
  acceptCamelCase?: boolean
}

/**
 * Resolves the admin scope for a write request.
 *
 * Returns `{ guard.allowed: false }` when an admin is acting on another client
 * without an explicit edit-mode signal. The caller must turn that into a 403
 * via `EDIT_MODE_REQUIRED_RESPONSE`.
 *
 * Returns `null` for unauthenticated / no-client-mapping cases — caller decides
 * whether to 401 or 404.
 */
export async function resolveAdminScope(
  args: ResolveAdminScopeArgs,
): Promise<
  | { ok: true; scope: ResolvedAdminScope }
  | { ok: false; status: 401 | 404; message: string }
> {
  const { supabase, req, body, queryClientId, acceptCamelCase } = args

  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData.user) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  const user = authData.user

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) {
    return { ok: false, status: 404, message: 'No client found' }
  }

  const ownClientId: string | null = (cu.client_id as string | null) ?? null
  const role = (cu.role as string) ?? 'viewer'

  // Admin override: prefer explicit query string > body.client_id > body.clientId.
  let overrideId: string | null = null
  if (role === 'admin') {
    if (queryClientId && queryClientId.trim()) overrideId = queryClientId.trim()
    else if (body && typeof body['client_id'] === 'string') overrideId = body['client_id'] as string
    else if (acceptCamelCase && body && typeof body['clientId'] === 'string') overrideId = body['clientId'] as string
  }

  const targetClientId = overrideId ?? (ownClientId ?? '')
  if (!targetClientId) {
    return { ok: false, status: 404, message: 'No client found' }
  }

  const guard = evaluateAdminScopeGuard({
    role,
    ownClientId,
    targetClientId,
    req,
    body: body ?? null,
  })

  return {
    ok: true,
    scope: { user, role, ownClientId, targetClientId, guard },
  }
}

/**
 * Convenience wrapper that returns a 403 response when the guard rejects the
 * write. Returns `null` when the request is allowed (so the caller can `if (denied) return denied`).
 */
export function rejectIfEditModeRequired(scope: ResolvedAdminScope): NextResponse | null {
  if (!scope.guard.allowed) {
    return NextResponse.json(EDIT_MODE_REQUIRED_RESPONSE, { status: 403 })
  }
  return null
}

export interface AuditWriteArgs {
  scope: ResolvedAdminScope
  route: string
  method: string
  payload?: unknown
  /** Optional snapshot of changed fields (e.g. from settings.update). Pass `null` when irrelevant. */
  beforeRow?: Record<string, unknown> | null
  afterRow?: Record<string, unknown> | null
  /** Field keys that were actually mutated (used to compute the diff). */
  fieldKeys?: readonly string[]
  status?: 'ok' | 'error'
  errorMessage?: string | null
}

/**
 * Records an admin_audit_log row for a cross-client write. Self-scope is a no-op.
 * Always non-blocking (errors swallowed inside `recordAdminAudit`).
 */
export async function auditAdminWrite(args: AuditWriteArgs): Promise<void> {
  const { scope, route, method, payload, beforeRow, afterRow, fieldKeys, status, errorMessage } = args
  if (!scope.guard.isCrossClient) return

  let beforeDiff: Record<string, unknown> | null = null
  let afterDiff: Record<string, unknown> | null = null
  if (fieldKeys && fieldKeys.length > 0) {
    const d = diffFields(beforeRow, afterRow, fieldKeys)
    beforeDiff = d.beforeDiff
    afterDiff = d.afterDiff
  }

  await recordAdminAudit({
    adminUserId: scope.user.id,
    targetClientId: scope.targetClientId,
    actingClientId: scope.ownClientId,
    route,
    method,
    payload,
    beforeDiff,
    afterDiff,
    status: status ?? 'ok',
    errorMessage: errorMessage ?? null,
  })
}
