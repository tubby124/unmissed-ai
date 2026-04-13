/**
 * POST /api/admin/backfill-niche-configs
 *
 * One-shot admin route to backfill custom_niche_config for existing 'other' + 'restaurant' clients.
 * Queries clients WHERE niche IN ('other','restaurant') AND custom_niche_config IS NULL AND status != 'paused'.
 * Calls generateNicheConfig() per client with a 100ms delay between calls.
 *
 * Auth: Admin only (role=admin).
 * Returns: { processed: N, failed: M, skipped: K }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { generateNicheConfig } from '@/lib/niche-generator'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || cu.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── Optional: dry_run mode (just returns count without writing) ───────────
  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; limit?: number }
  const isDryRun = body.dry_run === true
  const batchLimit = Math.min(body.limit ?? 50, 200) // cap at 200 per run

  // ── Query 'other' clients without a custom_niche_config ──────────────────
  const { data: clients, error: queryErr } = await svc
    .from('clients')
    .select('id, slug, business_name, gbp_summary, business_facts, city, niche')
    .in('niche', ['other', 'restaurant'])
    .is('custom_niche_config', null)
    .neq('status', 'paused')
    .limit(batchLimit)

  if (queryErr) {
    console.error('[backfill-niche-configs] Query failed:', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = clients ?? []
  console.log(`[backfill-niche-configs] Found ${rows.length} clients to backfill (dry_run=${isDryRun})`)

  if (isDryRun) {
    return NextResponse.json({ dry_run: true, would_process: rows.length, slugs: rows.map(r => r.slug) })
  }

  let processed = 0
  let failed = 0

  for (const client of rows) {
    const gbpSummary = (client.gbp_summary as string | null) || ''
    const businessFacts = Array.isArray(client.business_facts)
      ? (client.business_facts as string[]).slice(0, 10).join('\n')
      : (typeof client.business_facts === 'string' ? client.business_facts : '')

    const config = await generateNicheConfig(
      (client.business_name as string) || '',
      '',  // gbpCategory not stored on clients; gbpSummary carries the signal
      gbpSummary || businessFacts,
      '',  // no website scrape available at backfill time — rely on GBP + facts
      (client.city as string) || '',
    )

    if (config) {
      const { error: updateErr } = await svc
        .from('clients')
        .update({ custom_niche_config: config })
        .eq('id', client.id)

      if (updateErr) {
        console.error(`[backfill-niche-configs] DB update failed for ${client.slug}:`, updateErr)
        failed++
      } else {
        console.log(`[backfill-niche-configs] Updated ${client.slug} → ${config.industry}`)
        processed++
      }
    } else {
      console.warn(`[backfill-niche-configs] generateNicheConfig returned null for ${client.slug}`)
      failed++
    }

    // Rate-limit: 100ms between OpenRouter calls to avoid burst
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return NextResponse.json({ processed, failed, skipped: rows.length - processed - failed })
}
