/**
 * Shared lead_status mutator for `call_logs.lead_status`.
 *
 * Two callers exist:
 *   1. Dashboard PATCH `/api/dashboard/calls/[id]` — admin or client owner
 *      via Supabase session auth.
 *   2. Telegram cf:<uuid> handler — server-side service-role context.
 *      Cannot use the dashboard route because that route requires a user
 *      session (createServerClient + auth.getUser); the webhook runs as
 *      service-role.
 *
 * Both paths must enforce the same multi-tenant scope and the same
 * VALID_LEAD_STATUSES allowlist. Extracting one mutator here keeps the
 * SQL and validation in one place — anything else risks path-parity drift
 * (per docs/architecture/control-plane-mutation-contract.md §4 "Duplicate
 * save logic").
 *
 * Mutation class: DB_ONLY on a non-clients table — no agent sync, no
 * prompt patch, no knowledge reseed. Confirmed in the audit and in the
 * Tier 3 design doc.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadStatus = 'new' | 'called_back' | 'booked' | 'closed' | null

export const VALID_LEAD_STATUSES: ReadonlyArray<LeadStatus> = [
  'new',
  'called_back',
  'booked',
  'closed',
  null,
] as const

export function isValidLeadStatus(value: unknown): value is LeadStatus {
  return (VALID_LEAD_STATUSES as ReadonlyArray<unknown>).includes(value)
}

export type UpdateLeadStatusResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code: 'invalid_status' | 'not_found' | 'db_error' }

/**
 * Update `call_logs.lead_status` for a single call.
 *
 * Multi-tenant scope:
 *   - clientId === null   → no client scope (admin/service-role only).
 *                            Reserved for the dashboard admin path; do NOT
 *                            pass null from any service-role caller that
 *                            should be scoped (Telegram is always scoped).
 *   - clientId === string → call must belong to that client. The UPDATE
 *                            uses .eq('id', callId).eq('client_id', clientId)
 *                            so a wrong client_id returns 0 rows — looks
 *                            identical to "call not found", no info leak.
 */
export async function updateLeadStatusForClient(
  supa: SupabaseClient,
  callId: string,
  clientId: string | null,
  status: LeadStatus,
): Promise<UpdateLeadStatusResult> {
  if (!isValidLeadStatus(status)) {
    return { ok: false, error: 'Invalid lead_status', code: 'invalid_status' }
  }

  let q = supa.from('call_logs').update({ lead_status: status }).eq('id', callId)
  if (clientId !== null) {
    q = q.eq('client_id', clientId)
  }

  const { data, error } = await q.select('id').maybeSingle()
  if (error) return { ok: false, error: error.message, code: 'db_error' }
  if (!data) return { ok: false, error: 'Call not found', code: 'not_found' }
  return { ok: true, id: data.id as string }
}
