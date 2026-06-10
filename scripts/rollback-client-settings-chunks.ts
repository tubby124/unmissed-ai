/**
 * Emergency rollback — deletes ALL `source='settings_edit'` chunks for a client.
 *
 * Use case: if reseed-client-settings.ts --live produced bad/wrong chunks and we
 * need to restore the client's corpus to its pre-reseed state. Safe because
 * `settings_edit` chunks are derived from clients.business_facts + extra_qa,
 * which are still in the DB — running the reseed again with the same inputs
 * produces the same chunks.
 *
 * This script ONLY touches `source='settings_edit'` chunks. It does NOT touch:
 *   - website_scrape chunks
 *   - knowledge_doc chunks
 *   - compiled_import chunks
 *   - manual chunks
 *
 * Usage:
 *   npx tsx scripts/rollback-client-settings-chunks.ts --slug <slug>          # dry-run
 *   npx tsx scripts/rollback-client-settings-chunks.ts --slug <slug> --live   # actually delete
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

interface Args { slug: string | null; live: boolean }
function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const args: Args = { slug: null, live: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--live') args.live = true
    else if (a === '--help' || a === '-h') {
      console.error('Usage: --slug <slug> [--live]')
      process.exit(0)
    }
  }
  if (!args.slug) { console.error('--slug required'); process.exit(2) }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[rollback] Missing supabase env'); process.exit(2)
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const { data: client } = await supabase.from('clients').select('id, slug').eq('slug', args.slug!).maybeSingle()
  if (!client) { console.error(`[rollback] client '${args.slug}' not found`); process.exit(1) }

  const { count: targetCount } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', (client as { id: string }).id)
    .eq('source', 'settings_edit')

  console.log(`[rollback] Client: ${args.slug}`)
  console.log(`[rollback] settings_edit chunks targeted for deletion: ${targetCount ?? 0}`)
  console.log(`[rollback] Mode: ${args.live ? 'LIVE (will delete)' : 'DRY-RUN (no writes)'}`)

  if (!args.live) {
    console.log('[rollback] Dry-run — no chunks deleted. Pass --live to actually delete.')
    process.exit(0)
  }

  if ((targetCount ?? 0) === 0) {
    console.log('[rollback] Nothing to delete.')
    process.exit(0)
  }

  const { error: delErr } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('client_id', (client as { id: string }).id)
    .eq('source', 'settings_edit')

  if (delErr) { console.error(`[rollback] Delete failed: ${delErr.message}`); process.exit(1) }

  const { count: postCount } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', (client as { id: string }).id)
    .eq('source', 'settings_edit')
  console.log(`[rollback] Done. settings_edit chunks remaining: ${postCount ?? 0}`)
}

main().catch(e => { console.error('[rollback] fatal:', e); process.exit(1) })
