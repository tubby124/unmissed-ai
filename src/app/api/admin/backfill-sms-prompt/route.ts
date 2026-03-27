import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { patchSmsBlock } from '@/lib/prompt-patcher'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 300

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

  const dryRun = new URL(req.url).searchParams.get('dry_run') === 'true'
  const svc = createServiceClient()

  // ── Load all sms_enabled clients with prompts ─────────────────────────────
  const { data: clients, error: clientsErr } = await svc
    .from('clients')
    .select('id, slug, system_prompt, sms_enabled')
    .eq('sms_enabled', true)
    .not('system_prompt', 'is', null)

  if (clientsErr) {
    return NextResponse.json({ error: clientsErr.message }, { status: 500 })
  }

  const rows = clients ?? []

  type Result = { slug: string; status: 'skipped' | 'patched' | 'error'; reason?: string }
  const results: Result[] = []

  // ── Process in batches ────────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }

    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const client of batch) {
      try {
        const prompt = client.system_prompt as string

        if (prompt.includes('# SMS FOLLOW-UP')) {
          results.push({ slug: client.slug, status: 'skipped', reason: 'already patched' })
          continue
        }

        const patched = patchSmsBlock(prompt, true)

        if (!dryRun) {
          const { error: updateErr } = await svc
            .from('clients')
            .update({ system_prompt: patched })
            .eq('id', client.id)

          if (updateErr) {
            results.push({ slug: client.slug, status: 'error', reason: updateErr.message })
            continue
          }
        }

        results.push({ slug: client.slug, status: 'patched' })
      } catch (err) {
        results.push({
          slug: client.slug,
          status: 'error',
          reason: err instanceof Error ? err.message : 'unknown',
        })
      }
    }
  }

  const summary = {
    dry_run: dryRun,
    total: results.length,
    patched: results.filter(r => r.status === 'patched').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
  }

  if (!dryRun && summary.patched > 0) {
    console.log(`[backfill-sms-prompt] patched=${summary.patched} skipped=${summary.skipped} errors=${summary.errors}`)
  }

  const deploy_warning = !dryRun && summary.patched > 0
    ? `DB prompt patched for ${summary.patched} client(s). Deployed Ultravox agents are NOT updated. Run /prompt-deploy for each patched client to sync the live agent.`
    : undefined

  return NextResponse.json({ ...summary, ...(deploy_warning ? { deploy_warning } : {}), results })
}
