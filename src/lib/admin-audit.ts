import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'

// Phase 0.5.1 — Admin "acting as" audit log helper.
// Call this from any /api/dashboard/** route handler when an admin scoped a write
// via target_client_id. Writes a single row to admin_audit_log via service role.
//
// Failure to log MUST NOT block the user-facing write — log errors are swallowed.
// The plan: 2026-04-28-admin-dashboard-redesign-plan.md (Phase 0.5)

export interface AdminAuditEntry {
  adminUserId: string
  targetClientId: string
  actingClientId?: string | null
  route: string
  method: string
  payload?: unknown
  beforeDiff?: Record<string, unknown> | null
  afterDiff?: Record<string, unknown> | null
  status?: 'ok' | 'error'
  errorMessage?: string | null
}

function hashPayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null
  try {
    const json = JSON.stringify(payload)
    return createHash('sha256').update(json).digest('hex')
  } catch {
    return null
  }
}

export async function recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
  // Skip self-scope: admin acting on their own client row is normal, not "acting as".
  if (entry.actingClientId && entry.actingClientId === entry.targetClientId) return

  try {
    const svc = createServiceClient()
    await svc.from('admin_audit_log').insert({
      admin_user_id: entry.adminUserId,
      target_client_id: entry.targetClientId,
      acting_client_id: entry.actingClientId ?? null,
      route: entry.route,
      method: entry.method,
      payload_hash: hashPayload(entry.payload),
      before_diff: entry.beforeDiff ?? null,
      after_diff: entry.afterDiff ?? null,
      status: entry.status ?? 'ok',
      error_message: entry.errorMessage ?? null,
    })
  } catch {
    // intentionally swallowed — audit failures must not break the write path
  }
}

// Helper to compute before/after diffs from full row snapshots and the field set
// being updated. Keeps the audit row small and only includes changed fields.
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fieldKeys: readonly string[],
): { beforeDiff: Record<string, unknown>; afterDiff: Record<string, unknown> } {
  const beforeDiff: Record<string, unknown> = {}
  const afterDiff: Record<string, unknown> = {}
  for (const key of fieldKeys) {
    const b = before?.[key]
    const a = after?.[key]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      beforeDiff[key] = b ?? null
      afterDiff[key] = a ?? null
    }
  }
  return { beforeDiff, afterDiff }
}
