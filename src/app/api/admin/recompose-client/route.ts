/**
 * POST /api/admin/recompose-client
 *
 * Rebuilds a client's system prompt from the current slot context
 * (NICHE_DEFAULTS + DB state) and syncs the result to Ultravox.
 *
 * Use after shipping PERSONA sandwich (D377), LINGUISTIC_ANCHORS (D378),
 * or any NICHE_DEFAULTS change — existing clients need a Recompose to
 * pick up template improvements.
 *
 * Body: { client_id: string }
 * Returns: { ok, promptChanged, charCount, error? }
 *
 * Admin only. Idempotent — no-op if prompt hasn't changed.
 * Guard: only works on slot-format prompts (old-format clients must
 * migrate to slots first via D304 before this will run).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { recomposePrompt } from '@/lib/slot-regenerator'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = body.client_id as string | undefined
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const result = await recomposePrompt(clientId, user.id)

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    promptChanged: result.promptChanged,
    charCount: result.charCount ?? null,
  })
}
