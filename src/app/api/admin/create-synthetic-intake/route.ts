/**
 * POST /api/admin/create-synthetic-intake
 *
 * Admin-only. Creates a synthetic intake_submissions row for a legacy client
 * that was provisioned before the intake_submissions system existed.
 *
 * This unblocks Phase 4 deep-mode rebuild (buildAgentModeRebuildPrompt) for
 * clients that would otherwise throw "No intake submission found."
 *
 * Does NOT regenerate the prompt or sync Ultravox — just inserts the intake row.
 *
 * Body:  { clientId: string, force?: boolean }
 * force: required to replace an existing synthetic intake row.
 *        Refused if existing intake is NOT synthetic (protects real onboarding data).
 *
 * Returns: { ok: true, slug, created: boolean, replaced: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { clientToSyntheticIntake } from '@/lib/client-to-synthetic-intake'

export async function POST(req: NextRequest) {
  // ── Auth gate — admin only ──────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu || cu.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientId?: string; force?: boolean }
  const { clientId, force = false } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const svc = createServiceClient()

  try {
    // Build the synthetic intake payload from the clients row
    const { payload, slug } = await clientToSyntheticIntake(svc, clientId)

    // ── Idempotency check ─────────────────────────────────────────────────────
    const { data: existing } = await svc
      .from('intake_submissions')
      .select('id, intake_json')
      .eq('client_slug', slug)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const isExistingSynthetic =
        (existing.intake_json as Record<string, unknown>)?._synthetic_meta !== undefined &&
        (existing.intake_json as Record<string, unknown>)._synthetic_meta !== null &&
        typeof (existing.intake_json as Record<string, unknown>)._synthetic_meta === 'object' &&
        ((existing.intake_json as Record<string, unknown>)._synthetic_meta as Record<string, unknown>).synthetic === true

      if (!force) {
        return NextResponse.json(
          {
            error: 'An intake submission already exists for this client.' +
              (isExistingSynthetic
                ? ' Pass force=true to replace the synthetic intake.'
                : ' This client has real onboarding data — synthetic creation is not allowed.'),
          },
          { status: 409 },
        )
      }

      if (!isExistingSynthetic) {
        return NextResponse.json(
          { error: 'Cannot replace a real intake submission. This client has genuine onboarding data.' },
          { status: 409 },
        )
      }

      // Replace existing synthetic intake
      await svc.from('intake_submissions').delete().eq('id', existing.id)
      await svc.from('intake_submissions').insert({
        client_slug: slug,
        business_name: payload.business_name,
        niche: payload.niche,
        owner_name: payload.owner_name || null,
        intake_json: payload as unknown as Record<string, unknown>,
        submitted_at: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true, slug, created: false, replaced: true })
    }

    // ── Fresh insert ──────────────────────────────────────────────────────────
    await svc.from('intake_submissions').insert({
      client_slug: slug,
      business_name: payload.business_name,
      niche: payload.niche,
      owner_name: payload.owner_name || null,
      intake_json: payload as unknown as Record<string, unknown>,
      submitted_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, slug, created: true, replaced: false })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 404 })
  }
}
