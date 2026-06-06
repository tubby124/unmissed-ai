/**
 * Snapshot Aman post-Wave 3 Layer A WITH his existing niche_custom_variables
 * intact. This is the production-realistic case: Layer A ships in the slot
 * pipeline, but Aman's DB still carries the Wave 1.5 TRIAGE_DEEP / FORBIDDEN_EXTRA
 * personal override from earlier this session. Composed result has the
 * universal PERSONAL flow PLUS Wave 1.5's RE-specific branches — duplicate
 * personal content, but RE TRIAGE behavior preserved.
 *
 * No DB writes, no Ultravox calls.
 *
 *   npx tsx scripts/snapshot-aman-wave3-with-overrides.ts
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
  `tests/promptfoo/snapshots/walia-family-wave3-keep-${today}.txt`,
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

  const intake = clientRowToIntake(row, services ?? [], chunkCount ?? 0)
  const prompt = buildPromptFromIntake(intake)
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, prompt, 'utf8')
  console.log(`wrote ${OUT_PATH} (${prompt.length} chars)`)
}

main().catch(err => { console.error(err); process.exit(1) })
