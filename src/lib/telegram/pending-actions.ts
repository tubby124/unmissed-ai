/**
 * Tier 3 confirm-token TTL store.
 *
 * `cb:<id>` and `mk:<id>` taps create a pending action and reply with a
 * confirm prompt that carries `cf:<uuid>`. The user has 60 seconds to tap
 * confirm; after that the row is gone and the bot replies "expired".
 *
 * DB-backed (not in-memory) for two reasons:
 *   1. Railway redeploys discard in-memory state mid-flow. A confirm tap
 *      vanishing after a deploy would silently break a destructive
 *      mutation. The rate limiter is in-memory and that's fine — losing
 *      one minute of rate state is harmless. Losing a confirm token is
 *      not.
 *   2. The audit (§H.2) called out this exact failure mode.
 *
 * Multi-tenant guard: resolvePendingAction(token, chatId) requires both
 * the token AND the chat_id to match. A token issued in chat A used from
 * chat B returns null — same surface as expiry, no information leak.
 *
 * Sweeper: every call to resolvePendingAction first DELETEs expired rows
 * for the current chat (one extra round-trip, ~5ms). At ≤5 in-flight rows
 * across the fleet, this is cheaper than wiring pg_cron in Supabase and
 * avoids adding scheduled-job infrastructure for a 60-second feature.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type PendingActionKind = 'mark_called_back' | 'call_back_lead'

/**
 * Payload shape stored in the `payload` jsonb column.
 *
 * Both kinds carry call_id (the call_logs row to mutate), name (for the
 * confirm/toast text), and the lead's phone (mostly used by call_back_lead
 * to make tap-to-call easy in the reply, but harmless on either kind).
 */
export interface PendingActionPayload {
  call_id: string
  name: string | null
  phone: string | null
}

export interface PendingActionRow {
  client_id: string
  action_kind: PendingActionKind
  payload: PendingActionPayload
}

const TTL_SECONDS = 60

/**
 * Create a new pending-action row and return its token (uuid). Caller
 * formats the token as `cf:<token>` for the inline-keyboard callback_data.
 */
export async function createPendingAction(
  supa: SupabaseClient,
  params: {
    client_id: string
    chat_id: number
    kind: PendingActionKind
    payload: PendingActionPayload
  },
): Promise<string | null> {
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString()
  const { data, error } = await supa
    .from('telegram_pending_actions')
    .insert({
      chat_id: params.chat_id,
      client_id: params.client_id,
      action_kind: params.kind,
      payload: params.payload,
      expires_at: expiresAt,
    })
    .select('token')
    .maybeSingle()

  if (error || !data) {
    console.warn(`[telegram-pending] insert failed: ${error?.message ?? 'no row returned'}`)
    return null
  }
  return data.token as string
}

/**
 * Resolve a token to a pending action, consuming the row.
 *
 * Returns null when:
 *   - token does not exist
 *   - token exists but expires_at < now
 *   - token exists but chat_id mismatches (multi-tenant guard)
 *   - DB error
 *
 * The caller cannot distinguish these cases from the return value — that
 * is intentional, per the design doc: "never leak existence to a wrong
 * chat_id". A user who tries to redeem a stolen token sees the same
 * "expired" message as a user whose token actually expired.
 *
 * Side effect: also DELETEs all expired rows for the same chat (sweeper).
 */
export async function resolvePendingAction(
  supa: SupabaseClient,
  token: string,
  chatId: number,
): Promise<PendingActionRow | null> {
  // 1. Sweep expired rows for this chat. Cheap (≤5 rows fleet-wide), and
  //    keeps the table from accumulating dead rows even if no token is
  //    ever resolved. Errors are non-fatal — sweeping is best-effort.
  const sweepRes = await supa
    .from('telegram_pending_actions')
    .delete()
    .eq('chat_id', chatId)
    .lt('expires_at', new Date().toISOString())
  if (sweepRes.error) {
    console.warn(`[telegram-pending] sweeper failed (non-fatal): ${sweepRes.error.message}`)
  }

  // 2. Fetch the row scoped to this chat. If chat A issued the token and
  //    chat B is presenting it, this SELECT returns nothing — identical
  //    to expiry. No info leak that the token "exists somewhere else".
  const { data, error } = await supa
    .from('telegram_pending_actions')
    .select('token, client_id, action_kind, payload, expires_at')
    .eq('token', token)
    .eq('chat_id', chatId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) {
    if (error) console.warn(`[telegram-pending] resolve failed: ${error.message}`)
    return null
  }

  // 3. Consume — delete the row so it can't be replayed.
  const { error: delErr } = await supa
    .from('telegram_pending_actions')
    .delete()
    .eq('token', token)
  if (delErr) {
    console.warn(`[telegram-pending] consume failed (token=${token.slice(0, 8)}…): ${delErr.message}`)
    // Even if the delete failed, return the row so the user's confirm
    // tap doesn't fail silently. A stale row will be swept next time.
  }

  return {
    client_id: data.client_id as string,
    action_kind: data.action_kind as PendingActionKind,
    payload: data.payload as PendingActionPayload,
  }
}

/**
 * Cancel an in-flight pending action by deleting its row. Idempotent —
 * a missing row is fine. Used by the `cancel:<token>` callback path.
 */
export async function cancelPendingAction(
  supa: SupabaseClient,
  token: string,
  chatId: number,
): Promise<void> {
  const { error } = await supa
    .from('telegram_pending_actions')
    .delete()
    .eq('token', token)
    .eq('chat_id', chatId)
  if (error) {
    console.warn(`[telegram-pending] cancel failed: ${error.message}`)
  }
}
