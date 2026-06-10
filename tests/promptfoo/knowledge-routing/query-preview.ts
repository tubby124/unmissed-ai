/**
 * Query Preview — simulates the EXACT response the agent's `queryKnowledge`
 * tool would receive from `/api/knowledge/[slug]/query` for the niche scenarios.
 *
 * Mirrors src/app/api/knowledge/[slug]/query/route.ts:
 *   - same hybrid_match_knowledge RPC
 *   - same SIMILARITY_FLOOR=0.45, RRF_MIN_SCORE=0.005
 *   - same approved-only filter
 *   - same RRF + trust-tier sort
 *   - same _instruction wording
 *
 * Run BEFORE and AFTER a reseed to see exactly what changes in the agent's
 * runtime experience. This is the closest possible thing to a live call without
 * actually making one — useful when the operator (Hasan) wants to "see what
 * would happen" before pushing a fix to a live client.
 *
 * Usage:
 *   npx tsx tests/promptfoo/knowledge-routing/query-preview.ts --slug <slug>
 *   npx tsx tests/promptfoo/knowledge-routing/query-preview.ts --slug <slug> --json
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY (or OPENROUTER_API_KEY)
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { scenariosFor, canonicalNiche, type Scenario } from './scenarios'

const MATCH_COUNT = 5
const RRF_MIN_SCORE = 0.005
const SIMILARITY_FLOOR = 0.45
const TRUST_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

interface CliArgs { slug: string | null; json: boolean; reportPath: string | null }
function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const args: CliArgs = { slug: null, json: false, reportPath: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--report') args.reportPath = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.error('Usage: --slug <slug> [--json] [--report path.md]')
      process.exit(0)
    }
  }
  if (!args.slug) { console.error('--slug required'); process.exit(2) }
  return args
}

async function embedText(text: string): Promise<number[] | null> {
  const tryEmbed = async (provider: 'openai' | 'openrouter') => {
    const openaiKey = process.env.OPENAI_API_KEY
    const openrouterKey = process.env.OPENROUTER_API_KEY
    let url: string, headers: Record<string, string>, body: Record<string, unknown>
    if (provider === 'openai') {
      if (!openaiKey) return { ok: false, status: 0 }
      url = 'https://api.openai.com/v1/embeddings'
      headers = { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }
      body = { model: 'text-embedding-3-small', input: text }
    } else {
      if (!openrouterKey) return { ok: false, status: 0 }
      url = 'https://openrouter.ai/api/v1/embeddings'
      headers = { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' }
      body = { model: 'openai/text-embedding-3-small', input: text }
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) return { ok: false, status: res.status }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    return { ok: true, embedding: data.data?.[0]?.embedding ?? null, status: 200 }
  }
  const p = await tryEmbed('openai')
  if (p.ok && p.embedding) return p.embedding
  if (p.status === 429 || p.status >= 500 || p.status === 0) {
    const f = await tryEmbed('openrouter')
    if (f.ok && f.embedding) return f.embedding
  }
  return null
}

interface AgentVisible {
  scenarioId: string
  question: string
  resultCount: number
  topSimilarity: number | null
  topContent: string | null  // first 200 chars
  fullTopContent: string | null  // first 600 chars — what the agent's _instruction would quote
  topTrustTier: string | null
  topRrfScore: number | null
  // What the agent ACTUALLY sees in _instruction
  instruction: string
  matchedAny: boolean
  passesScenario: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runScenario(supabase: any, clientId: string, scenario: Scenario): Promise<AgentVisible> {
  const embedding = await embedText(scenario.question)
  if (!embedding) {
    return {
      scenarioId: scenario.id, question: scenario.question,
      resultCount: 0, topSimilarity: null, topContent: null, fullTopContent: null,
      topTrustTier: null, topRrfScore: null,
      instruction: '(embed failed)', matchedAny: false, passesScenario: false,
    }
  }
  const { data: rpcResults, error } = await supabase.rpc('hybrid_match_knowledge', {
    query_text: scenario.question, query_embedding: JSON.stringify(embedding),
    match_client_id: clientId, match_count: MATCH_COUNT,
    full_text_weight: 1.0, semantic_weight: 1.0, rrf_k: 50,
  })
  if (error) {
    return {
      scenarioId: scenario.id, question: scenario.question,
      resultCount: 0, topSimilarity: null, topContent: null, fullTopContent: null,
      topTrustTier: null, topRrfScore: null,
      instruction: `(RPC error: ${error.message})`, matchedAny: false, passesScenario: false,
    }
  }
  type RawMatch = { content: string; similarity: number; keyword_rank: number | null; rrf_score: number; status: string; trust_tier: string }
  const raw = (rpcResults ?? []) as RawMatch[]
  const filtered = raw.filter(m => {
    const hasKw = m.keyword_rank !== null
    const hasGoodSim = m.similarity >= SIMILARITY_FLOOR
    return (hasKw || hasGoodSim) && m.rrf_score >= RRF_MIN_SCORE && m.status === 'approved'
  })
  const sorted = filtered.sort((a, b) => {
    const scoreDiff = b.rrf_score - a.rrf_score
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff
    return (TRUST_ORDER[a.trust_tier] ?? 1) - (TRUST_ORDER[b.trust_tier] ?? 1)
  })
  const top = sorted[0]
  const matchedAny = top
    ? scenario.mustMatchAny.some(needle => top.content.toLowerCase().includes(needle.toLowerCase()))
    : false
  const passesScenario = matchedAny && (!scenario.mustNotMatch || !scenario.mustNotMatch.some(b => top!.content.toLowerCase().includes(b.toLowerCase())))

  // Mirror the live route's _instruction generation
  const topContent200 = top?.content?.slice(0, 200) ?? null
  const topContent600 = top?.content?.slice(0, 600) ?? null
  const trustQual = top?.trust_tier === 'high' ? '' : top?.trust_tier === 'low' ? ' This information has not been fully verified — be cautious.' : ''
  const instruction = top
    ? `Found: ${top.content.slice(0, 200)}. Read this back naturally — do not say 'according to our knowledge base' or 'our records show'.${trustQual}`
    : `No information found. Say you're not sure about that specific question and offer to have someone follow up.`

  return {
    scenarioId: scenario.id, question: scenario.question,
    resultCount: sorted.length,
    topSimilarity: top?.similarity ?? null,
    topContent: topContent200,
    fullTopContent: topContent600,
    topTrustTier: top?.trust_tier ?? null,
    topRrfScore: top?.rrf_score ?? null,
    instruction, matchedAny, passesScenario,
  }
}

function renderConsole(slug: string, niche: string | null, results: AgentVisible[]): string {
  const lines: string[] = []
  const bar = '═'.repeat(72)
  lines.push(bar)
  lines.push(`QUERY-PREVIEW (true-path simulation) — ${slug}`)
  lines.push(`Niche: ${canonicalNiche(niche) ?? 'unknown'} · ${results.length} scenarios`)
  lines.push(bar)
  for (const r of results) {
    const sym = r.passesScenario ? '✅ PASS' : r.matchedAny ? '🟠 MATCH (mustNotMatch?)' : r.resultCount > 0 ? '🟠 CHUNKS but NO MATCH' : '🔴 EMPTY'
    lines.push('')
    lines.push(`[${r.scenarioId}] ${sym}`)
    lines.push(`  Q: "${r.question}"`)
    lines.push(`  → results=${r.resultCount} · sim=${r.topSimilarity?.toFixed(3) ?? '----'} · trust=${r.topTrustTier ?? '----'} · rrf=${r.topRrfScore?.toFixed(4) ?? '----'}`)
    if (r.topContent) {
      lines.push(`  📜 Top chunk: "${r.topContent}${r.topContent.length === 200 ? '…' : ''}"`)
    }
    lines.push(`  🤖 Agent sees: ${r.instruction.slice(0, 240)}${r.instruction.length > 240 ? '…' : ''}`)
  }
  lines.push('')
  const passCount = results.filter(r => r.passesScenario).length
  lines.push('─'.repeat(72))
  lines.push(`SUMMARY: ${passCount}/${results.length} scenarios PASS · ${results.filter(r => r.resultCount === 0).length} empty · ${results.filter(r => r.resultCount > 0 && !r.passesScenario).length} match-fails`)
  lines.push('─'.repeat(72))
  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) { console.error('[query-preview] missing env'); process.exit(2) }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const { data: client } = await supabase.from('clients').select('id, slug, niche, knowledge_backend').eq('slug', args.slug!).maybeSingle()
  if (!client) { console.error(`[query-preview] '${args.slug}' not found`); process.exit(1) }
  const c = client as { id: string; slug: string; niche: string | null; knowledge_backend: string | null }

  if (c.knowledge_backend !== 'pgvector') {
    console.error(`[query-preview] client has knowledge_backend=${c.knowledge_backend ?? 'null'} — not pgvector, queryKnowledge tool not registered`)
    process.exit(1)
  }

  const scenarios = scenariosFor(c.niche)
  const results: AgentVisible[] = []
  for (const s of scenarios) {
    results.push(await runScenario(supabase, c.id, s))
  }

  if (args.json) {
    console.log(JSON.stringify({ slug: c.slug, niche: c.niche, capturedAt: new Date().toISOString(), results }, null, 2))
  } else {
    console.log(renderConsole(c.slug, c.niche, results))
  }

  if (args.reportPath) {
    const path = resolve(args.reportPath)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, renderConsole(c.slug, c.niche, results), 'utf8')
    console.error(`[query-preview] Report → ${path}`)
  }

  const allPass = results.every(r => r.passesScenario)
  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error('[query-preview] fatal:', e); process.exit(1) })
