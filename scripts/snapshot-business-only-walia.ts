/**
 * Snapshot Aman in business-only mode (is_forwarding_personal_cell=false).
 * Used to lock in regression coverage of the Layer C OFF path so future
 * FILTER tail edits don't silently break it.
 *
 * Reads Aman's DB row, flips the dual-mode flag in memory only, recomposes
 * via buildPromptFromIntake. No DB writes, no Ultravox calls.
 *
 *   npx tsx scripts/snapshot-business-only-walia.ts
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
  `tests/promptfoo/snapshots/walia-family-business-only-${today}.txt`,
)

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  const { data: client, error } = await svc
    .from('clients').select('*').eq('slug', SLUG).limit(1).maybeSingle()
  if (error || !client) throw new Error(`${SLUG} lookup failed: ${error?.message ?? 'not found'}`)

  const row = client as Record<string, unknown>
  const { data: services } = await svc.from('client_services').select('*').eq('client_id', row.id as string)
  const { count: chunkCount } = await svc
    .from('knowledge_chunks').select('*', { count: 'exact', head: true })
    .eq('client_id', row.id as string).eq('status', 'approved')

  // Flip the flag + drop the personal-flow snowflake override in-memory only
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
  const patched = {
    ...row,
    niche_custom_variables: stripped,
    is_forwarding_personal_cell: false,
  }
  const intake = clientRowToIntake(patched, services ?? [], chunkCount ?? 0)
  const prompt = buildPromptFromIntake(intake)

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, prompt, 'utf8')
  console.log(`wrote ${OUT_PATH} (${prompt.length} chars)`)
  console.log(`  has ## 3. PERSONAL section: ${prompt.includes('## 3. PERSONAL')}`)
  console.log(`  TRIAGE at section #: ${prompt.match(/## (\d+)\. TRIAGE/)?.[1] ?? 'NONE'}`)
  console.log(`  CLOSING at section #: ${prompt.match(/## (\d+)\. CLOSING/)?.[1] ?? 'NONE'}`)
}

main().catch(err => { console.error(err); process.exit(1) })
