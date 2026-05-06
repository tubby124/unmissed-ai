/**
 * KB-Aware Rollout Dry-Run — read-only audit for 4 candidate clients.
 *
 * Runs recomposePrompt(dryRun=true, forceRecompose=true) for each client and
 * captures: char delta, presence of new kb-aware rules, absence of old
 * blanket-route rules, and any safety/triage section drift.
 *
 * Writes per-client JSON + a combined markdown report to CALLINGAGENTS/00-Inbox/.
 * NO DB writes. NO Ultravox calls.
 *
 * Run: npx tsx scripts/dryrun-kb-aware-rollout.ts
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const OUT_DIR = path.resolve('CALLINGAGENTS/00-Inbox')

const TARGETS = [
  { slug: 'calgary-property-leasing', note: 'Brian — primary pilot for QUESTION_INTAKE fix (PM, hand_tuned=false)' },
  { slug: 'hasan-sharif',     note: 'snowflake, hand_tuned=true (deferred policy — preview only)' },
  { slug: 'urban-vibe',       note: 'D445 shipped, hand_tuned=true (PM, primary kb-aware target)' },
  { slug: 'velly-remodeling', note: 'concierge live client (Eric), hand_tuned=true' },
  { slug: 'windshield-hub',   note: 'D445 shipped, hand_tuned=false (auto-glass — no niche-specific kb rules)' },
]

const NEW_KB_AWARE_FRAGMENTS = [
  'queryKnowledge first',
  'For general building policies',
  'GENERAL questions about how the building works',
  'PRICING: For general published service rates',
  'AVAILABILITY: For general booking policy',
  'COMMISSION + FEES: For general published commission',
  'PROCEDURE PRICING:',
  'RESERVATIONS: For general reservation policy',
  'WAIT TIMES: For typical wait time guidance',
  // QUESTION_INTAKE fix (2026-05-06)
  'QUESTION INTAKE — caller\'s first move is a GENERAL POLICY question',
  'ANSWER-FIRST RULE: When queryKnowledge returns content',
  'TOOL-LATENCY BRIDGE: Before any HTTP tool fires',
]

const OLD_BLANKET_FRAGMENTS = [
  'NEVER answer questions about availability, pricing, pets, parking, or utilities — route every one',
  'NEVER quote specific repair or install prices — always route',
  'NEVER quote specific prices — always route',
  'NEVER confirm or deny appointment availability — always route',
  'NEVER quote specific service prices — always route',
  'NEVER confirm reservation availability — always route',
  'NEVER quote wait times or guarantee a table — always route',
  'NEVER quote specific treatment prices over the phone — always route',
  'NEVER quote specific prices without knowing the full scope — always route',
]

const SAFETY_GUARDS = [
  /9-?1-?1|emergency|burst pipe|gas smell|flooding/i,
  /Fair Housing|service animal|ESA|protected class/i,
  /never invent|never fabricate|never quote prices for items NOT listed/i,
]

function countMatches(text: string, fragments: string[]): { matched: string[]; missing: string[] } {
  const matched: string[] = []
  const missing: string[] = []
  for (const f of fragments) (text.includes(f) ? matched : missing).push(f)
  return { matched, missing }
}

function safetyGuardCount(text: string): number {
  return SAFETY_GUARDS.reduce((n, rx) => n + (rx.test(text) ? 1 : 0), 0)
}

type ClientRow = {
  id: string
  slug: string
  niche: string | null
  business_name: string | null
  agent_name: string | null
  ultravox_agent_id: string | null
  hand_tuned: boolean | null
  knowledge_backend: string | null
  system_prompt: string | null
}

type ChunkCount = { count: number | null }

async function dryrunClient(slug: string, adminUserId: string) {
  const { data: client, error } = await svc.from('clients')
    .select('id, slug, niche, business_name, agent_name, ultravox_agent_id, hand_tuned, knowledge_backend, system_prompt')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()
  if (error || !client) throw new Error(`${slug} lookup failed: ${error?.message ?? 'not found'}`)
  const row = client as unknown as ClientRow

  const { count: chunkCount } = await svc.from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', row.id)
    .eq('status', 'approved') as unknown as ChunkCount

  const result = await recomposePrompt(row.id, adminUserId, true, true)
  const current = (row.system_prompt ?? '') as string
  const preview = (result.preview ?? '') as string

  const newOnPreview = countMatches(preview, NEW_KB_AWARE_FRAGMENTS)
  const oldOnCurrent = countMatches(current, OLD_BLANKET_FRAGMENTS)
  const oldOnPreview = countMatches(preview, OLD_BLANKET_FRAGMENTS)
  const safetyCurrent = safetyGuardCount(current)
  const safetyPreview = safetyGuardCount(preview)

  const summary = {
    slug: row.slug,
    business_name: row.business_name,
    niche: row.niche,
    hand_tuned: row.hand_tuned,
    knowledge_backend: row.knowledge_backend,
    approved_kb_chunks: chunkCount ?? 0,
    current_chars: current.length,
    preview_chars: preview.length,
    char_delta: preview.length - current.length,
    new_kb_aware_fragments_in_preview: newOnPreview.matched,
    old_blanket_fragments_in_current: oldOnCurrent.matched,
    old_blanket_fragments_still_in_preview: oldOnPreview.matched, // should be empty
    safety_guards_current: safetyCurrent,
    safety_guards_preview: safetyPreview,
    safety_drift: safetyPreview - safetyCurrent, // negative = lost guards (BAD)
    recompose_success: result.success,
    recompose_error: result.error ?? null,
  }

  const detailFile = path.join(OUT_DIR, `dryrun-${slug}-kb-aware.json`)
  fs.writeFileSync(detailFile, JSON.stringify({
    summary,
    currentPrompt: current,
    previewPrompt: preview,
  }, null, 2))

  return { summary, detailFile }
}

async function main() {
  console.log('[1/3] Resolving admin user_id...')
  const { data: adminCu, error: cuErr } = await svc.from('client_users')
    .select('user_id, role').eq('role', 'admin').limit(1).maybeSingle()
  if (cuErr || !adminCu?.user_id) throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)
  const adminUserId = adminCu.user_id as string
  console.log(`  admin user_id=${adminUserId}`)

  console.log(`[2/3] Running dryRun=true, forceRecompose=true on ${TARGETS.length} clients...`)
  const summaries: Awaited<ReturnType<typeof dryrunClient>>['summary'][] = []
  for (const t of TARGETS) {
    console.log(`  - ${t.slug} (${t.note})`)
    try {
      const r = await dryrunClient(t.slug, adminUserId)
      summaries.push(r.summary)
      console.log(`    chars ${r.summary.current_chars} → ${r.summary.preview_chars} (Δ ${r.summary.char_delta >= 0 ? '+' : ''}${r.summary.char_delta}), kb chunks=${r.summary.approved_kb_chunks}`)
    } catch (e) {
      console.log(`    ERR: ${(e as Error).message}`)
    }
  }

  console.log('[3/3] Writing combined report...')
  const md: string[] = []
  md.push('# KB-Aware Rollout Dry-Run')
  md.push('')
  md.push(`Generated: ${new Date().toISOString()}`)
  md.push(`Method: \`recomposePrompt(clientId, userId, dryRun=true, forceRecompose=true)\``)
  md.push('')
  md.push(`READ-ONLY. No DB writes. No Ultravox calls. Per-client previewPrompt + currentPrompt JSON in this folder.`)
  md.push('')
  md.push('## Summary')
  md.push('')
  md.push('| Slug | Niche | Tuned | KB chunks | Chars (cur→new, Δ) | New kb-aware lines | Old blanket lines stripped | Safety guards (cur/new) | Status |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const s of summaries) {
    const stripped = s.old_blanket_fragments_in_current.length - s.old_blanket_fragments_still_in_preview.length
    const safetyStatus = s.safety_drift < 0 ? `⚠️ -${-s.safety_drift}` : `${s.safety_guards_current}/${s.safety_guards_preview}`
    const status = s.recompose_error
      ? `❌ ${s.recompose_error}`
      : s.safety_drift < 0
        ? '⚠️ safety guards lost'
        : s.new_kb_aware_fragments_in_preview.length > 0 && s.old_blanket_fragments_still_in_preview.length === 0
          ? '✅ kb-aware'
          : '🟡 review'
    md.push(`| ${s.slug} | ${s.niche} | ${s.hand_tuned} | ${s.approved_kb_chunks} | ${s.current_chars}→${s.preview_chars} (${s.char_delta >= 0 ? '+' : ''}${s.char_delta}) | ${s.new_kb_aware_fragments_in_preview.length} | ${stripped}/${s.old_blanket_fragments_in_current.length} | ${safetyStatus} | ${status} |`)
  }
  md.push('')
  md.push('## Per-client detail')
  md.push('')
  for (const s of summaries) {
    md.push(`### ${s.slug}`)
    md.push(`- business: ${s.business_name}`)
    md.push(`- niche: \`${s.niche}\` | hand_tuned: \`${s.hand_tuned}\` | kb_backend: \`${s.knowledge_backend}\` | chunks: ${s.approved_kb_chunks}`)
    md.push(`- prompt size: **${s.current_chars} → ${s.preview_chars}** (${s.char_delta >= 0 ? '+' : ''}${s.char_delta} chars)`)
    md.push(`- new kb-aware fragments added (${s.new_kb_aware_fragments_in_preview.length}):`)
    for (const f of s.new_kb_aware_fragments_in_preview) md.push(`  - \`${f}\``)
    md.push(`- old blanket-route fragments stripped from current → preview (${s.old_blanket_fragments_in_current.length - s.old_blanket_fragments_still_in_preview.length}/${s.old_blanket_fragments_in_current.length}):`)
    for (const f of s.old_blanket_fragments_in_current) {
      const stripped = !s.old_blanket_fragments_still_in_preview.includes(f)
      md.push(`  - ${stripped ? '✅' : '❌ STILL PRESENT'} \`${f.slice(0, 80)}...\``)
    }
    md.push(`- safety-guard pattern count: ${s.safety_guards_current} (current) → ${s.safety_guards_preview} (preview), drift: ${s.safety_drift >= 0 ? '+' : ''}${s.safety_drift}`)
    md.push('')
  }
  md.push('## Recommended next steps')
  md.push('')
  md.push('1. Review per-client JSON at `dryrun-{slug}-kb-aware.json` — diff `currentPrompt` vs `previewPrompt`.')
  md.push('2. Pick low-risk clients to live-recompose first. Skip any showing `safety guards lost` or `STILL PRESENT` blanket rules.')
  md.push('3. For each chosen client: copy/adapt `scripts/recompose-brian.ts` with the slug, run `--live`.')
  md.push('4. Real test call → check `tool_invocations` table for `queryKnowledge` fires.')
  md.push('5. **Snowflake clients with hand_tuned=true:** force-recompose wipes any hand-tuning. Confirm with owner before deploying.')
  md.push('')

  const reportFile = path.join(OUT_DIR, 'dryrun-kb-aware-rollout-report.md')
  fs.writeFileSync(reportFile, md.join('\n'))
  console.log(`  wrote ${reportFile}`)
  console.log(`  per-client JSON files: ${summaries.length}`)
  console.log('\nDone. Review the report:')
  console.log(`  cat "${reportFile}"`)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
