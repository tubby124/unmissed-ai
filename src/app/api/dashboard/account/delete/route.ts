/**
 * POST /api/dashboard/account/delete
 *
 * Self-service account deletion. Cancels Stripe subscription, deletes Ultravox agent,
 * purges DB rows (clients + client_users), then deletes Supabase auth users that are
 * exclusively linked to this client (won't delete shared admin accounts).
 *
 * Body: { clientId: string, confirmText: string }  — confirmText must equal "DELETE"
 * Returns: { success: true, deleted: {...}, warnings: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient, createServerClient } from '@/lib/supabase/server'
import { deleteAgent } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { clientId?: string; confirmText?: string }
  const { clientId, confirmText } = body

  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  if (confirmText !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 })

  const svc = createServiceClient()

  // Verify ownership (owner or admin)
  const { data: cu } = await svc
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Load client ────────────────────────────────────────────────────────────
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, stripe_subscription_id, ultravox_agent_id, twilio_number')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const deleted: Record<string, unknown> = {}
  const warnings: string[] = []

  // ── 1. Cancel Stripe subscription ─────────────────────────────────────────
  if (client.stripe_subscription_id) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
      await stripe.subscriptions.cancel(client.stripe_subscription_id)
      deleted.stripe_subscription = 'canceled'
    } catch (err) {
      warnings.push(`Stripe cancel failed: ${String(err).slice(0, 120)}`)
      deleted.stripe_subscription = 'cancel_failed'
    }
  } else {
    deleted.stripe_subscription = 'none'
  }

  // ── 2. Delete Ultravox agent ───────────────────────────────────────────────
  if (client.ultravox_agent_id) {
    try {
      await deleteAgent(client.ultravox_agent_id)
      deleted.ultravox_agent = 'deleted'
    } catch (err) {
      warnings.push(`Ultravox agent delete failed: ${String(err).slice(0, 120)}`)
      deleted.ultravox_agent = 'delete_failed'
    }
  } else {
    deleted.ultravox_agent = 'none'
  }

  // ── 3. Twilio number — log warning, do not auto-release ───────────────────
  if (client.twilio_number) {
    warnings.push(`Twilio number ${client.twilio_number} was NOT auto-released. Release manually in Twilio Console.`)
    deleted.twilio_number = 'not_released'
  }

  // ── 4. Collect user_ids that are exclusively linked to this client ─────────
  const { data: linkedUsers } = await svc
    .from('client_users')
    .select('user_id')
    .eq('client_id', clientId)

  const candidateIds = (linkedUsers ?? []).map(r => r.user_id as string)

  // Find any of those users who also appear in client_users for OTHER clients
  const { data: sharedUsers } = await svc
    .from('client_users')
    .select('user_id')
    .in('user_id', candidateIds)
    .neq('client_id', clientId)

  const sharedIds = new Set((sharedUsers ?? []).map(r => r.user_id as string))
  const exclusiveIds = candidateIds.filter(id => !sharedIds.has(id))

  // ── 5. Delete client_users ─────────────────────────────────────────────────
  const { count: cuCount } = await svc
    .from('client_users')
    .delete({ count: 'exact' })
    .eq('client_id', clientId)
  deleted.client_users = cuCount ?? 0

  // ── 6. Delete prompt_versions ──────────────────────────────────────────────
  await svc.from('prompt_versions').delete().eq('client_id', clientId)

  // ── 7. Delete clients row (cascades knowledge_chunks, call_logs, etc.) ─────
  const { error: clientDeleteErr } = await svc
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (clientDeleteErr) {
    warnings.push(`clients row delete failed: ${clientDeleteErr.message}`)
    deleted.clients = 'delete_failed'
  } else {
    deleted.clients = 1
  }

  // ── 8. Delete Supabase auth users (exclusive only) ────────────────────────
  let authDeleted = 0
  for (const uid of exclusiveIds) {
    try {
      const { error } = await svc.auth.admin.deleteUser(uid)
      if (!error) authDeleted++
      else warnings.push(`Auth user ${uid.slice(0, 8)} delete failed: ${error.message}`)
    } catch (err) {
      warnings.push(`Auth user ${uid.slice(0, 8)} delete threw: ${String(err).slice(0, 80)}`)
    }
  }
  deleted.auth_users = authDeleted

  console.log(`[account/delete] ${client.slug} deleted by user ${user.id.slice(0, 8)}: ${JSON.stringify(deleted)}`)

  return NextResponse.json({ success: true, deleted, warnings })
}
