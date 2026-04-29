/**
 * GET  /api/dashboard/website-sources?client_id=xxx
 *   Returns all website sources for a client + plan URL limit.
 *
 * DELETE /api/dashboard/website-sources
 *   Body: { clientId, url }
 *   Deletes the source record and its associated knowledge_chunks.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuthContext(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) return null
  return cu
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const cu = await getAuthContext(supabase)
  if (!cu) return new NextResponse('Unauthorized', { status: 401 })

  const params = req.nextUrl.searchParams
  const clientId = (cu.role === 'admin' && params.get('client_id'))
    ? params.get('client_id')!
    : cu.client_id

  const svc = createServiceClient()

  const [sourcesResult, clientResult] = await Promise.all([
    svc.from('client_website_sources')
      .select('id, url, scrape_status, last_scraped_at, chunk_count, scrape_error, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true }),
    svc.from('clients')
      .select('selected_plan, subscription_status')
      .eq('id', clientId)
      .single(),
  ])

  if (sourcesResult.error) {
    return NextResponse.json({ error: sourcesResult.error.message }, { status: 500 })
  }

  let maxWebsiteUrls = 1
  if (clientResult.data) {
    const isTrialing = clientResult.data.subscription_status === 'trialing'
    const plan = getPlanEntitlements(isTrialing ? 'trial' : clientResult.data.selected_plan)
    maxWebsiteUrls = plan.maxWebsiteUrls
  }

  return NextResponse.json({
    sources: sourcesResult.data ?? [],
    maxWebsiteUrls,
  })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as { clientId?: string; url?: string; client_id?: string; edit_mode_confirmed?: boolean }
  const clientId = body.clientId?.trim()
  const url = body.url?.trim()

  if (!clientId || !url) {
    return NextResponse.json({ error: 'clientId and url required' }, { status: 400 })
  }

  const normalizedBody: Record<string, unknown> = { ...body, client_id: clientId }
  const resolved = await resolveAdminScope({
    supabase,
    req,
    body: normalizedBody,
    acceptCamelCase: true,
  })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role !== 'admin' && scope.ownClientId !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const svc = createServiceClient()

  // Delete associated knowledge chunks tagged with this source_url
  await svc
    .from('knowledge_chunks')
    .delete()
    .eq('client_id', clientId)
    .eq('source_url', url)

  // Delete the source record
  const { error } = await svc
    .from('client_website_sources')
    .delete()
    .eq('client_id', clientId)
    .eq('url', url)

  if (error) {
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/website-sources',
        method: 'DELETE',
        payload: { client_id: clientId, url },
        status: 'error',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/website-sources',
      method: 'DELETE',
      payload: { client_id: clientId, url },
    })
  }
  return NextResponse.json({ ok: true })
}
