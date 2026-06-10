/**
 * Corpus Inspector — companion to audit.ts.
 *
 * Catches the bug class that the Layer 1 audit surfaces but cannot diagnose
 * deeply: "the client's business_facts and extra_qa have rich answers, but they
 * never reached pgvector as approved chunks." Symptom: pgvector queries return
 * empty results for questions the dashboard clearly answers.
 *
 * Witnessed 2026-06-03 on calgary-property-leasing (Brian): 16 approved chunks,
 * all sourced from `website_scrape`. ZERO from `settings_edit`. Meanwhile his
 * `extra_qa` has a full Q/A pair for the rent guarantee program, and his
 * `business_facts` has a paragraph explaining 90% market value. The agent's
 * queryKnowledge tool gets empty → it deflects → looks like a routing failure
 * when the actual bug is "reseedKnowledgeFromSettings() never fired for him."
 *
 * This script:
 *   1. Lists every approved chunk, grouped by source
 *   2. Lists every business_facts entry and every extra_qa pair
 *   3. Diffs: which settings entries have NO substring match in any approved
 *      chunk → these are content owners populated but the corpus doesn't have
 *   4. Optionally checks `chunk_type='faq_pair'` or `source='settings_edit'`
 *      presence as a binary signal: zero rows of either kind = reseed never ran
 *
 * Usage:
 *   npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --slug <slug>
 *   npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --slug <slug> --json
 *   npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --all
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

interface Chunk {
  id: string
  content: string
  source: string
  chunk_type: string
  trust_tier: string
  status: string
  created_at: string
}

interface FaqPair {
  q: string
  a: string
}

interface ClientCorpus {
  slug: string
  niche: string | null
  knowledgeBackend: string | null
  chunkCount: number
  chunksBySource: Record<string, number>
  hasFaqPairChunks: boolean
  hasSettingsEditChunks: boolean
  businessFacts: string[]
  extraQa: FaqPair[]
  websiteUrl: string | null
  websiteScrapeStatus: string | null
  // Diagnostic outputs
  factsNotInCorpus: string[]
  qaPairsNotInCorpus: FaqPair[]
  reseedFlag: 'never-ran' | 'partial' | 'complete' | 'no-settings-content'
}

function parseArgs(): { slug: string | null; all: boolean; json: boolean } {
  const argv = process.argv.slice(2)
  const args = { slug: null as string | null, all: false, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--all') args.all = true
    else if (a === '--json') args.json = true
    else if (a === '--help' || a === '-h') {
      console.error('Usage: --slug <slug> | --all [--json]')
      process.exit(0)
    }
  }
  if (!args.slug && !args.all) {
    console.error('Usage: --slug <slug> | --all [--json]')
    process.exit(2)
  }
  return args
}

/**
 * Heuristic substring presence check. A settings entry is "in the corpus" if any
 * approved chunk contains a meaningful slice of its content. Uses first 50 chars
 * (skipping leading filler) so paraphrase still counts as present.
 */
function isInCorpus(needle: string, chunks: Chunk[]): boolean {
  const cleaned = needle.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 20) return true // too short to meaningfully assert
  // Use 3-4 distinctive word ngrams from the entry
  const words = cleaned.split(' ').filter(w => w.length > 3)
  if (words.length < 3) return true
  // Pick 3 consecutive distinctive words from the middle
  const start = Math.max(0, Math.floor(words.length / 2) - 1)
  const ngram = words.slice(start, start + 3).join(' ')
  return chunks.some(c => c.content.toLowerCase().includes(ngram))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function inspectOne(supabase: any, slug: string): Promise<ClientCorpus | { error: string; slug: string }> {
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, slug, niche, knowledge_backend, business_facts, extra_qa, website_url, website_scrape_status')
    .eq('slug', slug)
    .maybeSingle()
  if (clientErr || !client) return { error: clientErr?.message ?? 'not found', slug }

  const { data: chunks } = await supabase
    .from('knowledge_chunks')
    .select('id, content, source, chunk_type, trust_tier, status, created_at')
    .eq('client_id', client.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  const chunkList = (chunks ?? []) as Chunk[]
  const chunksBySource: Record<string, number> = {}
  for (const c of chunkList) {
    chunksBySource[c.source] = (chunksBySource[c.source] ?? 0) + 1
  }

  const hasFaqPairChunks = chunkList.some(c => c.chunk_type === 'faq_pair' || c.chunk_type === 'qa')
  const hasSettingsEditChunks = chunkList.some(c => c.source === 'settings_edit')

  const businessFacts: string[] = Array.isArray(client.business_facts)
    ? (client.business_facts as unknown[]).filter((f: unknown): f is string => typeof f === 'string')
    : []
  const extraQaRaw: unknown[] = Array.isArray(client.extra_qa) ? (client.extra_qa as unknown[]) : []
  const extraQa: FaqPair[] = extraQaRaw.filter((p: unknown): p is FaqPair => {
    if (!p || typeof p !== 'object') return false
    const o = p as Record<string, unknown>
    return typeof o.q === 'string' && typeof o.a === 'string'
  })

  // Diagnostic: which settings entries aren't reachable from chunks?
  const factsNotInCorpus: string[] = businessFacts.filter((f: string) => !isInCorpus(f, chunkList))
  const qaPairsNotInCorpus: FaqPair[] = extraQa.filter((qa: FaqPair) => !isInCorpus(qa.a, chunkList))

  // Reseed flag
  let reseedFlag: ClientCorpus['reseedFlag']
  const hasSettingsContent = businessFacts.length > 0 || extraQa.length > 0
  if (!hasSettingsContent) {
    reseedFlag = 'no-settings-content'
  } else if (!hasSettingsEditChunks && !hasFaqPairChunks) {
    reseedFlag = 'never-ran'
  } else if (factsNotInCorpus.length > 0 || qaPairsNotInCorpus.length > 0) {
    reseedFlag = 'partial'
  } else {
    reseedFlag = 'complete'
  }

  return {
    slug: client.slug,
    niche: client.niche,
    knowledgeBackend: client.knowledge_backend,
    chunkCount: chunkList.length,
    chunksBySource,
    hasFaqPairChunks,
    hasSettingsEditChunks,
    businessFacts,
    extraQa,
    websiteUrl: client.website_url,
    websiteScrapeStatus: client.website_scrape_status,
    factsNotInCorpus,
    qaPairsNotInCorpus,
    reseedFlag,
  }
}

function renderClient(c: ClientCorpus): string {
  const lines: string[] = []
  const bar = '═'.repeat(72)
  lines.push(bar)
  lines.push(`CORPUS INSPECTION — ${c.slug}`)
  lines.push(bar)
  lines.push('')
  lines.push(`Niche: ${c.niche ?? 'unknown'} · KB backend: ${c.knowledgeBackend ?? 'null'}`)
  lines.push(`Website: ${c.websiteUrl ?? '(none)'} · scrape status: ${c.websiteScrapeStatus ?? '(none)'}`)
  lines.push('')
  lines.push(`Approved chunks: ${c.chunkCount}`)
  for (const [source, count] of Object.entries(c.chunksBySource)) {
    lines.push(`  - ${source.padEnd(28)} ${count}`)
  }
  lines.push('')
  lines.push(`Settings content:`)
  lines.push(`  business_facts entries: ${c.businessFacts.length}`)
  lines.push(`  extra_qa pairs:         ${c.extraQa.length}`)
  lines.push('')
  lines.push(`Reseed flag: ${c.reseedFlag.toUpperCase()}`)
  if (c.reseedFlag === 'never-ran') {
    lines.push(`  → reseedKnowledgeFromSettings() has NEVER fired for this client.`)
    lines.push(`  → Settings content is injected ONLY via {{businessFacts}} template-context at call time.`)
    lines.push(`  → queryKnowledge tool sees ZERO of it. Trigger a PATCH to extra_qa or business_facts`)
    lines.push(`    (or call reseedKnowledgeFromSettings directly) to push settings into pgvector chunks.`)
  } else if (c.reseedFlag === 'partial') {
    lines.push(`  → Some settings content is in pgvector; some entries are missing.`)
    lines.push(`  → Re-run reseed to refresh, or investigate why specific entries didn't embed.`)
  } else if (c.reseedFlag === 'complete') {
    lines.push(`  → Settings content fully reflected in pgvector chunks.`)
  } else {
    lines.push(`  → No business_facts or extra_qa configured — nothing to reseed.`)
  }
  lines.push('')

  if (c.factsNotInCorpus.length > 0) {
    lines.push(`business_facts NOT in corpus (${c.factsNotInCorpus.length}):`)
    for (const f of c.factsNotInCorpus.slice(0, 10)) {
      lines.push(`  - "${f.slice(0, 100)}${f.length > 100 ? '…' : ''}"`)
    }
    if (c.factsNotInCorpus.length > 10) lines.push(`  … and ${c.factsNotInCorpus.length - 10} more`)
    lines.push('')
  }
  if (c.qaPairsNotInCorpus.length > 0) {
    lines.push(`extra_qa pairs NOT in corpus (${c.qaPairsNotInCorpus.length}):`)
    for (const qa of c.qaPairsNotInCorpus.slice(0, 10)) {
      lines.push(`  - Q: "${qa.q.slice(0, 60)}${qa.q.length > 60 ? '…' : ''}"`)
      lines.push(`    A: "${qa.a.slice(0, 100)}${qa.a.length > 100 ? '…' : ''}"`)
    }
    if (c.qaPairsNotInCorpus.length > 10) lines.push(`  … and ${c.qaPairsNotInCorpus.length - 10} more`)
    lines.push('')
  }

  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[corpus-inspect] Missing supabase env')
    process.exit(2)
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  let slugs: string[]
  if (args.all) {
    const { data: fleet } = await supabase
      .from('clients')
      .select('slug')
      .not('ultravox_agent_id', 'is', null)
      .order('slug', { ascending: true })
    slugs = (fleet ?? []).map((c: { slug: string }) => c.slug)
  } else {
    slugs = [args.slug!]
  }

  const results: Array<ClientCorpus | { error: string; slug: string }> = []
  for (const slug of slugs) {
    const r = await inspectOne(supabase, slug)
    results.push(r)
    if ('error' in r) {
      console.error(`[corpus-inspect] ${slug}: ${r.error}`)
      continue
    }
    if (!args.json) console.log(renderClient(r))
  }

  if (args.json) console.log(JSON.stringify(results, null, 2))

  if (args.all && !args.json) {
    console.log('═'.repeat(72))
    console.log('FLEET RESEED-STATE SUMMARY')
    console.log('═'.repeat(72))
    console.log('slug                              reseed-state         chunks  facts  qa')
    console.log('─'.repeat(72))
    for (const r of results) {
      if ('error' in r) {
        console.log(`${r.slug.padEnd(33)} ERROR`)
        continue
      }
      console.log(
        `${r.slug.padEnd(33)} ` +
        `${r.reseedFlag.padEnd(20)} ` +
        `${String(r.chunkCount).padStart(6)} ` +
        `${String(r.businessFacts.length).padStart(6)} ` +
        `${String(r.extraQa.length).padStart(3)}`
      )
    }
    console.log('')
  }

  // Exit code: 1 if any client has never-ran or partial reseed (actionable)
  const actionable = results.some(r => !('error' in r) && (r.reseedFlag === 'never-ran' || r.reseedFlag === 'partial'))
  process.exit(actionable ? 1 : 0)
}

main().catch(e => {
  console.error('[corpus-inspect] fatal:', e instanceof Error ? e.stack ?? e.message : String(e))
  process.exit(3)
})
