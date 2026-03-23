/**
 * POST /api/admin/cleanup-test
 *
 * Admin-only endpoint to clean up test artifacts (clients, auth users,
 * prompt versions, intake submissions, and optionally Ultravox agents).
 *
 * Body: { clientSlug: string, deleteUltravox?: boolean, deleteIntake?: boolean }
 * Returns: { deleted: { ... } }
 *
 * By default, intake submissions are RESET to 'pending' (not deleted),
 * so you can re-run test-activate on the same intake. Pass deleteIntake: true
 * to fully remove them.
 *
 * Safety: refuses to delete protected production slugs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const PROTECTED_SLUGS = ['hasan-sharif', 'windshield-hub', 'urban-vibe', 'manzil-isa']

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientSlug?: string; deleteUltravox?: boolean; deleteIntake?: boolean }
  const clientSlug = body.clientSlug?.trim()
  const deleteUltravox = body.deleteUltravox ?? false
  const deleteIntake = body.deleteIntake ?? false

  if (!clientSlug) return NextResponse.json({ error: 'clientSlug required' }, { status: 400 })

  // ── Safety check ───────────────────────────────────────────────────────────
  if (PROTECTED_SLUGS.includes(clientSlug)) {
    return NextResponse.json(
      { error: `Cannot delete protected client: ${clientSlug}` },
      { status: 403 },
    )
  }

  // ── Load client ────────────────────────────────────────────────────────────
  const { data: client } = await svc
    .from('clients')
    .select('id, ultravox_agent_id, twilio_number')
    .eq('slug', clientSlug)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: `Client not found: ${clientSlug}` }, { status: 404 })
  }

  const clientId = client.id as string
  const deleted: Record<string, unknown> = {}

  // ── Warn if Twilio number assigned ─────────────────────────────────────────
  if (client.twilio_number) {
    deleted.twilio_warning = `Twilio number ${client.twilio_number} was assigned but NOT released. Release manually if needed.`
    console.warn(`[cleanup-test] Twilio number ${client.twilio_number} not released for ${clientSlug}`)
  }

  // ── Delete client_users ────────────────────────────────────────────────────
  const { count: cuCount } = await svc
    .from('client_users')
    .delete({ count: 'exact' })
    .eq('client_id', clientId)
  deleted.client_users = cuCount ?? 0

  // ── Delete prompt_versions ─────────────────────────────────────────────────
  const { count: pvCount } = await svc
    .from('prompt_versions')
    .delete({ count: 'exact' })
    .eq('client_id', clientId)
  deleted.prompt_versions = pvCount ?? 0

  // ── Reset or delete intake_submissions ─────────────────────────────────────
  if (deleteIntake) {
    const { count: isCount } = await svc
      .from('intake_submissions')
      .delete({ count: 'exact' })
      .eq('client_slug', clientSlug)
    deleted.intake_submissions = `deleted ${isCount ?? 0}`
  } else {
    const { count: isCount } = await svc
      .from('intake_submissions')
      .update({ status: 'pending', progress_status: 'pending', client_id: null })
      .eq('client_slug', clientSlug)
    deleted.intake_submissions = `reset ${isCount ?? 0} to pending`
  }

  // ── Delete Ultravox agent ──────────────────────────────────────────────────
  if (deleteUltravox && client.ultravox_agent_id) {
    try {
      const apiKey = process.env.ULTRAVOX_API_KEY
      if (apiKey) {
        const res = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        })
        deleted.ultravox_agent = res.ok ? 'deleted' : `failed (${res.status})`
        console.log(`[cleanup-test] Ultravox agent ${client.ultravox_agent_id}: ${deleted.ultravox_agent}`)
      } else {
        deleted.ultravox_agent = 'skipped (no API key)'
      }
    } catch (err) {
      deleted.ultravox_agent = `error: ${String(err).slice(0, 100)}`
    }
  } else {
    deleted.ultravox_agent = deleteUltravox ? 'no agent ID on client' : 'skipped (deleteUltravox=false)'
  }

  // ── Delete clients row ─────────────────────────────────────────────────────
  const { error: deleteErr } = await svc
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (deleteErr) {
    deleted.clients = `failed: ${deleteErr.message}`
    console.error(`[cleanup-test] clients delete failed: ${deleteErr.message}`)
  } else {
    deleted.clients = 1
  }

  console.log(`[cleanup-test] Cleaned up ${clientSlug}: ${JSON.stringify(deleted)}`)

  return NextResponse.json({ clientSlug, deleted })
}
