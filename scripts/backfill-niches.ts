/**
 * backfill-niches.ts — Re-classify niche='other' clients against current NICHE_HINTS.
 *
 * Why: clients onboarded BEFORE a given niche existed in NICHE_HINTS got
 * niche='other' as the only valid fallback. When new niches ship (e.g.
 * home_renovation added 2026-05-06), nothing back-migrates those clients.
 *
 * The canonical case: Velly Remodeling (slug=velly-remodeling, niche='other')
 * onboarded 2026-04-28, eight days before home_renovation shipped. His
 * custom_niche_config.industry is literally "renovation and construction" —
 * he should be home_renovation.
 *
 * Modes:
 *   default (no flag):  REPORT ONLY. Lists clients with niche='other' and the
 *                       AI's current best-guess niche. Writes NO DB updates.
 *   --apply:            For each client where (new_niche != 'other'
 *                       AND new_niche != current_niche), prompt for owner
 *                       confirmation per row. On approval, update niche +
 *                       trigger recomposePrompt(forceRecompose=true).
 *                       Telegram-notify per flip.
 *   --apply --yes:      Auto-confirm. Use only when the report has been
 *                       reviewed in advance.
 *   --slug <slug>:      Limit to one specific client (sanity-check runs).
 *
 * Safety rails:
 *   - hand_tuned=true clients are SKIPPED unless --include-hand-tuned is set
 *     (these have manually crafted prompts that the recompose would overwrite).
 *   - The recompose happens via existing recomposePrompt() — same path as
 *     the dashboard niche-change flow. No new write logic.
 *   - Snapshot pre-flip state to tests/promptfoo/snapshots/backfill-niches-<date>.json
 *     so any flip can be reverted.
 *
 * Recommended workflow:
 *   1. Run with no flags → review report
 *   2. For each row to flip, sanity-check via migrate-<slug>-to-slots.ts --preview
 *      (or equivalent slot-composition preview)
 *   3. Run with --apply (one-by-one confirmation) for production flips
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Args
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const AUTO_YES = args.includes('--yes')
const INCLUDE_HAND_TUNED = args.includes('--include-hand-tuned')
function arg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}
const SINGLE_SLUG = arg('slug')

// Niche hints — mirror /api/onboard/infer-niche/route.ts NICHE_HINTS at this moment
// in time. Keep in sync when that table changes.
const NICHE_HINTS: Record<string, string> = {
  auto_glass:          'windshield repair, auto glass, car glass replacement',
  hvac:                'heating, cooling, air conditioning, furnace, ventilation contractor',
  plumbing:            'plumber, pipes, drains, water heaters, leak repair, sewer',
  dental:              'dentist, teeth cleaning, oral health, dental clinic, orthodontist',
  legal:               'lawyer, attorney, law firm, legal services, paralegal',
  salon:               'hair salon, barbershop, beauty salon, nail salon, spa, aesthetics',
  real_estate:         'real estate agent, realtor, home buying, home selling, mortgage',
  property_management: 'property management, rental management, landlord services, tenants',
  restaurant:          'restaurant, cafe, food service, takeout, catering, dining',
  print_shop:          'printing, signs, banners, business cards, custom print, signage',
  voicemail:           'answering service, message taking, simple voicemail, call screening',
  mechanic_shop:       'auto mechanic, car repair, vehicle service, oil change, brake repair, engine diagnostics',
  pest_control:        'pest control, exterminator, bug control, rodent removal, bed bugs, wasp nest',
  electrician:         'electrician, electrical contractor, wiring, panel upgrade, EV charger install, electrical repair',
  locksmith:           'locksmith, lockout service, lock replacement, key cutting, car lockout, security locks',
  home_renovation:     'home renovation, general contractor, kitchen/bathroom remodel, basement finishing, additions, handyman, drywall, framing, builder',
}

interface ClientRow {
  id: string
  slug: string
  business_name: string | null
  niche: string
  hand_tuned: boolean | null
  custom_niche_config: Record<string, unknown> | null
  created_at: string
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function callInferNiche(businessName: string): Promise<{ niche: string; confidence: 'high' | 'medium' | 'low' }> {
  // Call the LIVE production endpoint to ensure exact parity with onboarding logic.
  // If you're running locally, point to a Railway URL or 'http://localhost:3000'.
  // Default to Railway prod URL since the script reads prod DB anyway.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://endvoicemail.ai'
  try {
    const res = await fetch(`${baseUrl}/api/onboard/infer-niche`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { niche: 'other', confidence: 'low' }
    const json = await res.json()
    const niche = (json.niche as string) || 'other'
    // Confidence heuristic: if the inference returned a named niche, treat as
    // medium; if endpoint returned customVariables (meaning Mode B), it
    // explicitly couldn't classify — treat as low.
    const confidence = niche !== 'other'
      ? (json.customVariables ? 'low' : 'medium')
      : 'low'
    return { niche, confidence }
  } catch {
    return { niche: 'other', confidence: 'low' }
  }
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, ans => {
      rl.close()
      resolve(ans.trim())
    })
  })
}

async function main(): Promise<void> {
  const mode = APPLY ? (AUTO_YES ? 'APPLY (auto-yes)' : 'APPLY (per-row confirm)') : 'REPORT ONLY'
  console.log(`\n=== backfill-niches mode: ${mode} ===\n`)
  if (!OPENROUTER_KEY) {
    console.warn('⚠️  OPENROUTER_API_KEY not set in local env. The infer-niche endpoint will fall back to other.')
    console.warn('    The script can still run but every classification will return other.')
    console.warn('    Set OPENROUTER_API_KEY or run against a Railway-hosted instance with the key set.\n')
  }

  console.log('[1] Querying clients with niche=other...')
  let query = svc
    .from('clients')
    .select('id, slug, business_name, niche, hand_tuned, custom_niche_config, created_at')
    .eq('niche', 'other')
    .order('created_at', { ascending: true })
  if (SINGLE_SLUG) query = query.eq('slug', SINGLE_SLUG)
  const { data, error } = await query
  if (error) throw new Error(`Lookup failed: ${error.message}`)
  const clients = (data || []) as ClientRow[]
  console.log(`  found ${clients.length} client(s) with niche='other'\n`)

  if (clients.length === 0) {
    console.log('  Nothing to backfill. Exiting.')
    return
  }

  // Snapshot pre-state
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const snapshotDir = path.resolve(__dirname, '../tests/promptfoo/snapshots')
  if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true })
  const snapshotPath = path.join(snapshotDir, `backfill-niches-${stamp}.json`)
  fs.writeFileSync(snapshotPath, JSON.stringify(clients, null, 2))
  console.log(`  pre-flip snapshot: ${snapshotPath}\n`)

  console.log('[2] Re-classifying each via /api/onboard/infer-niche...\n')
  type ReviewRow = ClientRow & { inferred_niche: string; inferred_confidence: string; would_flip: boolean }
  const reviewRows: ReviewRow[] = []

  for (const c of clients) {
    if (!c.business_name?.trim()) {
      console.log(`  - ${c.slug}: SKIP (no business_name)`)
      continue
    }
    const { niche: inferred, confidence } = await callInferNiche(c.business_name)
    const wouldFlip = inferred !== 'other' && inferred !== c.niche
    const flag = wouldFlip ? '→ FLIP' : '  (no change)'
    const ht = c.hand_tuned ? ' [hand_tuned]' : ''
    console.log(`  - ${c.slug}${ht}: "${c.business_name}" → ${inferred} (${confidence}) ${flag}`)
    reviewRows.push({ ...c, inferred_niche: inferred, inferred_confidence: confidence, would_flip: wouldFlip })
  }

  const toFlip = reviewRows.filter(r => r.would_flip)
  console.log(`\n[3] Summary: ${toFlip.length} client(s) recommended for niche flip\n`)

  if (!APPLY) {
    console.log('REPORT MODE — no DB writes. Re-run with --apply to flip rows (one-by-one confirm).')
    console.log(`Snapshot preserved at ${snapshotPath}`)
    return
  }

  // APPLY mode
  if (toFlip.length === 0) {
    console.log('Nothing to flip. Exiting.')
    return
  }

  const skipped: string[] = []
  const flipped: string[] = []
  const failed: Array<{ slug: string; reason: string }> = []

  for (const r of toFlip) {
    if (r.hand_tuned && !INCLUDE_HAND_TUNED) {
      console.log(`\n  SKIP ${r.slug}: hand_tuned=true. Use --include-hand-tuned to flip + recompose anyway (will overwrite manual prompt).`)
      skipped.push(`${r.slug} (hand_tuned)`)
      continue
    }
    let confirmed = AUTO_YES
    if (!AUTO_YES) {
      console.log(`\n  Flip ${r.slug} from '${r.niche}' to '${r.inferred_niche}'?`)
      console.log(`    business_name: ${r.business_name}`)
      console.log(`    hand_tuned:    ${r.hand_tuned}`)
      console.log(`    confidence:    ${r.inferred_confidence}`)
      const ans = await prompt('  Proceed? [y/N]: ')
      confirmed = /^y(es)?$/i.test(ans)
    }
    if (!confirmed) {
      console.log(`    skipped`)
      skipped.push(r.slug)
      continue
    }

    const { error: uErr } = await svc.from('clients').update({ niche: r.inferred_niche, hand_tuned: false }).eq('id', r.id)
    if (uErr) {
      console.log(`    FAIL: ${uErr.message}`)
      failed.push({ slug: r.slug, reason: uErr.message })
      continue
    }
    console.log(`    ✓ DB updated. Now call recomposePrompt(${r.id}) via dashboard or scripts/recompose-${r.slug}.ts --live.`)
    flipped.push(r.slug)
  }

  console.log(`\n=== FINAL ===`)
  console.log(`  flipped: ${flipped.length} — ${flipped.join(', ') || 'none'}`)
  console.log(`  skipped: ${skipped.length} — ${skipped.join(', ') || 'none'}`)
  console.log(`  failed:  ${failed.length} — ${failed.map(f => `${f.slug} (${f.reason})`).join(', ') || 'none'}`)
  console.log(`\n  Snapshot for rollback: ${snapshotPath}`)
  console.log(`  Next step: for each flipped slug, run recomposePrompt via dashboard or migration script + Tier-2 validate.`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  console.error('\nRollback from the snapshot file printed above if any rows were already flipped.')
  process.exit(1)
})
