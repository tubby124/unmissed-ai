/**
 * Snapshot Aman post-Wave 3 Layer A (universal MESSAGE FLOW + softened WRONG
 * NUMBER). Drops the Wave 1.5 niche_custom_variables personal override so
 * Layer A is the sole source of the personal-message behavior — this is the
 * fleet-wide pattern, not a snowflake.
 *
 * No DB writes, no Ultravox calls.
 *
 *   npx tsx scripts/snapshot-aman-wave3.ts
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildPromptFromIntake } from '../src/lib/prompt-builder'
import { clientRowToIntake } from '../src/lib/slot-regenerator'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'walia-family'
const today = new Date().toISOString().slice(0, 10)
const OUT_PATH = join(
  process.cwd(),
  `tests/promptfoo/snapshots/walia-family-wave3-${today}.txt`,
)

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/4] Looking up ${SLUG}...`)
  const { data: client, error } = await svc
    .from('clients')
    .select('*')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (error || !client) {
    throw new Error(`${SLUG} lookup failed: ${error?.message ?? 'not found'}`)
  }

  const row = client as Record<string, unknown>
  console.log(`  hand_tuned = ${row.hand_tuned}`)
  console.log(`  niche      = ${row.niche}`)

  console.log('[2/4] Loading services + knowledge chunks...')
  const { data: services } = await svc
    .from('client_services')
    .select('*')
    .eq('client_id', row.id as string)
  const { count: chunkCount } = await svc
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', row.id as string)
    .eq('status', 'approved')

  console.log(`  services         = ${services?.length ?? 0}`)
  console.log(`  knowledge chunks = ${chunkCount ?? 0}`)

  console.log('[3/4] Stripping Wave 1.5 personal override from niche_custom_variables...')
  const current = (row.niche_custom_variables as Record<string, unknown> | null) ?? {}
  const stripped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(current)) {
    if (k === 'TRIAGE_DEEP') continue
    if (k === 'FORBIDDEN_EXTRA') {
      const text = String(v ?? '')
      const cleaned = text
        .split(/\r?\n/)
        .filter(line => !line.toLowerCase().includes('personal calls'))
        .join('\n')
        .trim()
      if (cleaned) stripped[k] = cleaned
      continue
    }
    stripped[k] = v
  }
  console.log(`  ncv before = ${Object.keys(current).length} keys: ${Object.keys(current).join(', ')}`)
  console.log(`  ncv after  = ${Object.keys(stripped).length} keys: ${Object.keys(stripped).join(', ')}`)

  const patchedRow = { ...row, niche_custom_variables: stripped }
  const intake = clientRowToIntake(patchedRow, services ?? [], chunkCount ?? 0)

  console.log('[4/4] buildPromptFromIntake() with stripped overrides...')
  const prompt = buildPromptFromIntake(intake)
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, prompt, 'utf8')
  console.log(`  wrote ${OUT_PATH} (${prompt.length} chars)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
