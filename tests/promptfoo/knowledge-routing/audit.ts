/**
 * Knowledge-Routing Audit — Universal Layer 1 Diagnostic
 *
 * Read-only diagnostic for ANY unmissed.ai client's knowledge-routing health.
 * Runs 4 checks (~$0 cost, all pure reads / one embed call per scenario):
 *
 *   1. TOOL REGISTRATION
 *      DB (clients.tools) AND Ultravox (callTemplate.selectedTools) both contain
 *      queryKnowledge (or queryCorpus for backend='ultravox').
 *
 *   2. PGVECTOR CONTENT
 *      For each niche-templated test query, embed → hybrid_match_knowledge RPC →
 *      apply same filters as the live route (SIMILARITY_FLOOR=0.45, RRF_MIN=0.005,
 *      status='approved'). Reports per-query result count + top similarity.
 *
 *   3. PROMPT DRIFT
 *      Normalize (strip markers + whitespace) DB system_prompt vs Ultravox
 *      callTemplate.systemPrompt → SHA256 compare. Flags propagation gaps.
 *
 *   4. PROMPT-BLOAT INSTRUCTION FATIGUE
 *      Char count vs 12K target. Count + line-position queryKnowledge instructions.
 *      6+ instructions across 20K+ chars = likely GLM-4.6 long-context degradation.
 *
 * Output: structured suspect ranking + concrete next-action recommendation.
 *
 * Usage:
 *   npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug>
 *   npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug> --json
 *   npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug> --report path.md
 *
 * Env required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY or OPENROUTER_API_KEY  (embeddings for pgvector queries)
 *   ULTRAVOX_API_KEY                       (agent fetch for drift check)
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { execSync } from 'child_process'

import { scenariosFor, canonicalNiche, type Scenario } from './scenarios'

// ── Constants (mirror src/app/api/knowledge/[slug]/query/route.ts) ───────────
const MATCH_COUNT = 5
const RRF_MIN_SCORE = 0.005
const SIMILARITY_FLOOR = 0.45
const PROMPT_CHAR_TARGET = 12_000 // glm46-prompting-rules.md target
const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

// ── Types ────────────────────────────────────────────────────────────────────
interface CliArgs {
  slug: string | null     // null when --all
  all: boolean            // --all → iterate every client with ultravox_agent_id
  json: boolean
  reportPath: string | null
  noReport: boolean       // --no-report → skip auto-write
  strict: boolean         // --strict → exit 1 on WARN too (default: only FAIL)
}

interface ClientRow {
  id: string
  slug: string
  niche: string | null
  business_name: string | null
  agent_name: string | null
  system_prompt: string | null
  knowledge_backend: string | null
  ultravox_agent_id: string | null
  tools: unknown
  hand_tuned: boolean | null
}

interface ToolNameExtract {
  name: string
  shape: 'toolName' | 'nameOverride' | 'temporaryTool' | 'unknown'
  index: number
}

interface ScenarioResult {
  scenario: Scenario
  resultCount: number
  topSimilarity: number | null
  topContent: string | null
  topTrustTier: string | null
  matchedAny: boolean
  error: string | null
}

interface CheckResult {
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP'
  summary: string
  details: string[]
}

interface AuditReport {
  slug: string
  niche: string | null
  agentId: string | null
  deployedChars: number
  handTuned: boolean
  knowledgeBackend: string | null
  approvedChunkCount: number
  checks: {
    toolRegistration: CheckResult
    pgvectorContent: CheckResult & { scenarios: ScenarioResult[] }
    promptDrift: CheckResult
    promptBloat: CheckResult & { instructionPositions: Array<{ line: number; snippet: string }> }
  }
  suspectRanking: Array<{ rank: number; suspect: string; probability: string; fix: string }>
  nextActions: string[]
  generatedAt: string
  // Provenance — locks the audit to a specific commit for reproducibility
  gitSha: string
  gitBranch: string
  gitDirty: boolean
  auditVersion: string  // bump when checks/suspect-ranking logic changes
}

const AUDIT_VERSION = '1.1.0' // 1.0.0 = first ship (2026-06-03). 1.1.0 = canonical-niche, fleet --all, exit codes, 429 fallback.

interface GitProvenance {
  sha: string
  branch: string
  dirty: boolean
}

// ── CLI parsing ──────────────────────────────────────────────────────────────
function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const args: CliArgs = { slug: null, all: false, json: false, reportPath: null, noReport: false, strict: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug') args.slug = argv[++i]
    else if (a === '--all') args.all = true
    else if (a === '--json') args.json = true
    else if (a === '--report') args.reportPath = argv[++i]
    else if (a === '--no-report') args.noReport = true
    else if (a === '--strict') args.strict = true
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    }
  }
  if (!args.slug && !args.all) {
    printUsage()
    process.exit(2)
  }
  if (args.slug && args.all) {
    console.error('[audit] --slug and --all are mutually exclusive')
    process.exit(2)
  }
  return args
}

function printUsage(): void {
  console.error('Usage:')
  console.error('  npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug> [flags]')
  console.error('  npx tsx tests/promptfoo/knowledge-routing/audit.ts --all [flags]')
  console.error('')
  console.error('Flags:')
  console.error('  --slug <slug>     audit a single client by slug')
  console.error('  --all             audit every client with an ultravox_agent_id (fleet mode)')
  console.error('  --json            output JSON instead of human-readable console')
  console.error('  --report <path>   write markdown report to specific path')
  console.error('  --no-report       skip auto-writing the markdown report')
  console.error('  --strict          exit 1 on WARN as well as FAIL (default: only FAIL → exit 1)')
  console.error('')
  console.error('Exit codes:')
  console.error('  0  all checks PASS/SKIP (or WARN without --strict)')
  console.error('  1  one or more checks FAIL (or WARN with --strict)')
  console.error('  2  invalid CLI args or missing env')
  console.error('  3  fatal runtime error (DB/network/Ultravox unreachable)')
  console.error('')
  console.error('Examples:')
  console.error('  npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug calgary-property-leasing')
  console.error('  npx tsx tests/promptfoo/knowledge-routing/audit.ts --all --json > fleet.json')
  console.error('  npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug hasan-sharif --strict --no-report')
}

// ── Git provenance (locks the audit to a specific commit) ────────────────────
function getGitProvenance(): GitProvenance {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 12)
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0
    return { sha, branch, dirty }
  } catch {
    return { sha: 'unknown', branch: 'unknown', dirty: false }
  }
}

// ── Tool name extraction (drift-detection-pattern.md contract) ───────────────
function extractToolNames(tools: unknown): ToolNameExtract[] {
  if (!Array.isArray(tools)) return []
  return tools.map((t, index) => {
    if (!t || typeof t !== 'object') return { name: `__UNKNOWN_${index}__`, shape: 'unknown' as const, index }
    const obj = t as Record<string, unknown>
    if (typeof obj.toolName === 'string') return { name: obj.toolName, shape: 'toolName' as const, index }
    if (typeof obj.nameOverride === 'string') return { name: obj.nameOverride, shape: 'nameOverride' as const, index }
    const tt = obj.temporaryTool as Record<string, unknown> | undefined
    if (tt && typeof tt.modelToolName === 'string') return { name: tt.modelToolName, shape: 'temporaryTool' as const, index }
    return { name: `__UNKNOWN_${index}__`, shape: 'unknown' as const, index }
  })
}

// ── Inline embedText with 429 fallback (avoids src/lib path-alias coupling) ──
// Tries OpenAI direct first, falls back to OpenRouter on 429 (quota exceeded) or
// any 5xx. Mirrors src/lib/embeddings.ts contract but adds runtime resilience —
// silent failure mid-audit was a real failure mode (caught 2026-06-03).
type EmbedProvider = 'openai' | 'openrouter'

async function tryEmbedWith(provider: EmbedProvider, text: string): Promise<{ embedding: number[] | null; status: number; error: string | null }> {
  const openaiKey = process.env.OPENAI_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY
  let url: string, headers: Record<string, string>, body: Record<string, unknown>
  if (provider === 'openai') {
    if (!openaiKey) return { embedding: null, status: 0, error: 'no_key' }
    url = 'https://api.openai.com/v1/embeddings'
    headers = { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }
    body = { model: 'text-embedding-3-small', input: text }
  } else {
    if (!openrouterKey) return { embedding: null, status: 0, error: 'no_key' }
    url = 'https://openrouter.ai/api/v1/embeddings'
    headers = { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' }
    body = { model: 'openai/text-embedding-3-small', input: text }
  }
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const errText = (await res.text().catch(() => '')).slice(0, 200)
      return { embedding: null, status: res.status, error: errText }
    }
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    return { embedding: data.data?.[0]?.embedding ?? null, status: 200, error: null }
  } catch (e) {
    return { embedding: null, status: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

async function embedText(text: string): Promise<number[] | null> {
  // Primary: OpenAI direct
  const primary = await tryEmbedWith('openai', text)
  if (primary.embedding) return primary.embedding

  // Fallback triggers: 429 (quota), 5xx (transient), no_key (env missing)
  const shouldFallback = primary.status === 429 || (primary.status >= 500 && primary.status < 600) || primary.error === 'no_key'
  if (!shouldFallback && primary.error) {
    console.error(`[audit] embed primary failed (no fallback for status ${primary.status}): ${primary.error.slice(0, 120)}`)
    return null
  }

  if (primary.status === 429) {
    console.error(`[audit] embed primary 429 (quota exceeded) — falling back to OpenRouter`)
  } else if (primary.status >= 500) {
    console.error(`[audit] embed primary ${primary.status} — falling back to OpenRouter`)
  }

  const fallback = await tryEmbedWith('openrouter', text)
  if (fallback.embedding) return fallback.embedding

  console.error(`[audit] embed fallback also failed: status=${fallback.status} error=${(fallback.error ?? '').slice(0, 120)}`)
  return null
}

// ── Prompt normalization (for drift compare) ─────────────────────────────────
// Strips: (a) section markers (both open and close — the / is critical),
//         (b) template-context plumbing appended by updateAgent() on the Ultravox
//             side ({{callerContext}}, {{businessFacts}}, {{contextData}} and the
//             INJECTED REFERENCE DATA boilerplate that wraps {{contextData}}).
// Per per-call-context-contract.md: DB stores the base prompt; updateAgent() adds
// the template-context placeholders to ensure the Ultravox-stored config can
// receive call-time injection. Drift detection must ignore this layer.
function normalizePrompt(s: string): string {
  return s
    .replace(/<!-- \/?unmissed:[^>]+ -->/g, '') // strip section markers
    .replace(/\{\{(callerContext|businessFacts|contextData)\}\}/g, '') // strip template-context placeholders
    .replace(/## INJECTED REFERENCE DATA[\s\S]*?(?=\n##|\n#|$)/g, '') // strip the wrapper block that Ultravox-side gets
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12)
}

// ── Check 1: Tool registration ───────────────────────────────────────────────
async function checkToolRegistration(
  client: ClientRow,
  ultravoxAgent: { callTemplate?: { selectedTools?: unknown } } | null,
): Promise<CheckResult> {
  const expectedTool = client.knowledge_backend === 'ultravox' ? 'queryCorpus' : 'queryKnowledge'
  const dbTools = extractToolNames(client.tools)
  const dbHas = dbTools.some(t => t.name === expectedTool)
  const details: string[] = []
  details.push(`Expected tool: ${expectedTool} (knowledge_backend=${client.knowledge_backend ?? 'null'})`)
  details.push(`DB clients.tools: ${dbTools.length} tools total · ${expectedTool} ${dbHas ? 'PRESENT ✓' : 'MISSING ✗'}`)

  if (dbTools.some(t => t.shape === 'unknown')) {
    details.push(`WARNING: ${dbTools.filter(t => t.shape === 'unknown').length} tool(s) had unknown wire shape — drift detector contract violation`)
  }

  if (!ultravoxAgent) {
    details.push('Ultravox agent: COULD NOT FETCH (likely missing ULTRAVOX_API_KEY or invalid agent_id)')
    return { status: dbHas ? 'WARN' : 'FAIL', summary: 'Ultravox fetch failed; DB-only check', details }
  }

  const uvTools = extractToolNames(ultravoxAgent.callTemplate?.selectedTools)
  const uvHas = uvTools.some(t => t.name === expectedTool)
  details.push(`Ultravox callTemplate.selectedTools: ${uvTools.length} tools total · ${expectedTool} ${uvHas ? 'PRESENT ✓' : 'MISSING ✗'}`)

  // Note: per architecture docs, clients.tools is RUNTIME-authoritative (toolOverrides at call
  // time), so even if Ultravox agent has stale tools, runtime is fine if DB has it. We surface
  // both for transparency.
  if (dbHas && uvHas) return { status: 'PASS', summary: `${expectedTool} registered in DB + Ultravox`, details }
  if (dbHas && !uvHas) return { status: 'WARN', summary: `${expectedTool} in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)`, details }
  if (!dbHas && uvHas) return { status: 'FAIL', summary: `${expectedTool} missing from clients.tools — runtime calls will NOT include it`, details }
  return { status: 'FAIL', summary: `${expectedTool} missing from both DB and Ultravox — tool never registered`, details }
}

// ── Check 2: pgvector content ────────────────────────────────────────────────
// supabase typed as `any` because we use the untyped createClient (no Database
// generic) — script-style. The RPC return shape is asserted inline at the call site.
async function checkPgvectorContent(
  client: ClientRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<CheckResult & { scenarios: ScenarioResult[] }> {
  const scenarios = scenariosFor(client.niche)
  const details: string[] = []
  const results: ScenarioResult[] = []

  if (client.knowledge_backend !== 'pgvector') {
    details.push(`SKIP: knowledge_backend=${client.knowledge_backend ?? 'null'} (not pgvector)`)
    return { status: 'SKIP', summary: 'pgvector not enabled', details, scenarios: [] }
  }

  for (const scenario of scenarios) {
    const embedding = await embedText(scenario.question)
    if (!embedding) {
      results.push({ scenario, resultCount: 0, topSimilarity: null, topContent: null, topTrustTier: null, matchedAny: false, error: 'embed_failed' })
      details.push(`  [${scenario.id.padEnd(22)}] EMBED FAILED`)
      continue
    }

    const { data: rpcResults, error: rpcErr } = await supabase.rpc('hybrid_match_knowledge', {
      query_text: scenario.question,
      query_embedding: JSON.stringify(embedding),
      match_client_id: client.id,
      match_count: MATCH_COUNT,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50,
    })

    if (rpcErr) {
      results.push({ scenario, resultCount: 0, topSimilarity: null, topContent: null, topTrustTier: null, matchedAny: false, error: rpcErr.message })
      details.push(`  [${scenario.id.padEnd(22)}] RPC ERROR: ${rpcErr.message}`)
      continue
    }

    type RawMatch = { id: string; content: string; similarity: number; keyword_rank: number | null; rrf_score: number; status: string; trust_tier: string }
    const raw = (rpcResults ?? []) as RawMatch[]
    const filtered = raw.filter(m => {
      const hasKw = m.keyword_rank !== null
      const hasGoodSim = m.similarity >= SIMILARITY_FLOOR
      return (hasKw || hasGoodSim) && m.rrf_score >= RRF_MIN_SCORE && m.status === 'approved'
    })

    const top = filtered[0]
    const matchedAny = top
      ? scenario.mustMatchAny.some(needle => top.content.toLowerCase().includes(needle.toLowerCase()))
      : false

    results.push({
      scenario,
      resultCount: filtered.length,
      topSimilarity: top?.similarity ?? null,
      topContent: top?.content?.slice(0, 200) ?? null,
      topTrustTier: top?.trust_tier ?? null,
      matchedAny,
      error: null,
    })

    const matchedFlag = matchedAny ? '✓' : top ? '⚠' : '✗'
    const simStr = top ? top.similarity.toFixed(3) : '----'
    details.push(`  [${scenario.id.padEnd(22)}] ${matchedFlag} ${filtered.length} chunks · sim=${simStr} · tier=${top?.trust_tier ?? '----'}`)
  }

  const passCount = results.filter(r => r.matchedAny).length
  const total = results.length
  const emptyCount = results.filter(r => r.resultCount === 0).length

  let status: CheckResult['status']
  if (passCount === total) status = 'PASS'
  else if (passCount >= Math.ceil(total * 0.7)) status = 'WARN'
  else status = 'FAIL'

  const summary = `${passCount}/${total} scenarios match KB content${emptyCount > 0 ? ` · ${emptyCount} empty results (corpus gaps)` : ''}`
  return { status, summary, details, scenarios: results }
}

// ── Check 3: Prompt drift ────────────────────────────────────────────────────
async function checkPromptDrift(
  client: ClientRow,
  ultravoxAgent: { callTemplate?: { systemPrompt?: string } } | null,
): Promise<CheckResult> {
  const details: string[] = []
  const dbPrompt = client.system_prompt ?? ''
  details.push(`DB clients.system_prompt:        ${dbPrompt.length.toLocaleString()} chars · sha=${sha256(dbPrompt)}`)

  if (!ultravoxAgent?.callTemplate?.systemPrompt) {
    details.push('Ultravox callTemplate.systemPrompt: UNAVAILABLE')
    return { status: 'SKIP', summary: 'Ultravox agent fetch unavailable — cannot compare', details }
  }

  const uvPrompt = ultravoxAgent.callTemplate.systemPrompt
  details.push(`Ultravox callTemplate.systemPrompt: ${uvPrompt.length.toLocaleString()} chars · sha=${sha256(uvPrompt)}`)

  const dbNorm = normalizePrompt(dbPrompt)
  const uvNorm = normalizePrompt(uvPrompt)
  const dbNormSha = sha256(dbNorm)
  const uvNormSha = sha256(uvNorm)

  details.push(`Normalized DB sha=${dbNormSha} · Normalized Ultravox sha=${uvNormSha}`)

  if (dbNormSha === uvNormSha) {
    return { status: 'PASS', summary: 'DB and Ultravox prompts match (normalized)', details }
  }

  // Find first 200-char diff window for quick eyeballing
  let firstDiff = -1
  const limit = Math.min(dbNorm.length, uvNorm.length)
  for (let i = 0; i < limit; i++) {
    if (dbNorm[i] !== uvNorm[i]) { firstDiff = i; break }
  }
  if (firstDiff === -1 && dbNorm.length !== uvNorm.length) firstDiff = limit
  details.push(`First divergence at char ${firstDiff} (out of ${limit})`)
  return { status: 'WARN', summary: 'DB and Ultravox prompts differ — propagation gap or manual edit', details }
}

// ── Check 4: Prompt-bloat instruction fatigue ────────────────────────────────
function checkPromptBloat(client: ClientRow): CheckResult & { instructionPositions: Array<{ line: number; snippet: string }> } {
  const prompt = client.system_prompt ?? ''
  const details: string[] = []
  const chars = prompt.length
  details.push(`Total prompt: ${chars.toLocaleString()} chars · target ${PROMPT_CHAR_TARGET.toLocaleString()} (ratio ${(chars / PROMPT_CHAR_TARGET).toFixed(2)}x)`)

  // Find every line that mentions queryKnowledge or queryCorpus
  const expectedTool = client.knowledge_backend === 'ultravox' ? 'queryCorpus' : 'queryKnowledge'
  const lines = prompt.split('\n')
  const positions: Array<{ line: number; snippet: string }> = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(expectedTool)) {
      const snippet = lines[i].trim().slice(0, 80)
      positions.push({ line: i + 1, snippet })
    }
  }

  details.push(`Tool instructions (${expectedTool} mentions): ${positions.length}`)
  for (const p of positions) {
    details.push(`  L${String(p.line).padStart(4)}: ${p.snippet}${p.snippet.length === 80 ? '…' : ''}`)
  }

  // Heuristic: GLM-4.6 long-context degradation tends to bite when:
  //   - Prompt > 15K chars AND
  //   - The same instruction appears 4+ times across the prompt
  // (consistent with lost-in-the-middle research + the Brian 0% production hit rate)
  const longContext = chars > 15_000
  const triplicated = positions.length >= 4
  const overTarget = chars > PROMPT_CHAR_TARGET

  let status: CheckResult['status']
  let summary: string
  if (longContext && triplicated) {
    status = 'FAIL'
    summary = `${chars.toLocaleString()}c prompt + ${positions.length} tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)`
  } else if (overTarget) {
    status = 'WARN'
    summary = `Prompt over 12K target (${chars.toLocaleString()}c) — compression recommended`
  } else if (positions.length === 0) {
    status = 'FAIL'
    summary = `No ${expectedTool} instructions in prompt — agent has no priming to call the tool`
  } else {
    status = 'PASS'
    summary = `Prompt within bounds (${chars.toLocaleString()}c, ${positions.length} tool instructions)`
  }

  return { status, summary, details, instructionPositions: positions }
}

// ── Ultravox agent fetch ─────────────────────────────────────────────────────
async function fetchUltravoxAgent(agentId: string): Promise<{ callTemplate?: { systemPrompt?: string; selectedTools?: unknown } } | null> {
  const key = process.env.ULTRAVOX_API_KEY
  if (!key) {
    console.error('[audit] ULTRAVOX_API_KEY not set — skipping live agent fetch')
    return null
  }
  try {
    const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}`, {
      headers: { 'X-API-Key': key },
    })
    if (!res.ok) {
      console.error(`[audit] Ultravox GET /agents/${agentId} → ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
      return null
    }
    return (await res.json()) as { callTemplate?: { systemPrompt?: string; selectedTools?: unknown } }
  } catch (e) {
    console.error(`[audit] Ultravox fetch threw: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

// ── Suspect ranking ──────────────────────────────────────────────────────────
function rankSuspects(report: AuditReport): { ranking: AuditReport['suspectRanking']; nextActions: string[] } {
  const ranking: AuditReport['suspectRanking'] = []
  const next: string[] = []
  let rank = 1

  const { toolRegistration, pgvectorContent, promptDrift, promptBloat } = report.checks

  if (toolRegistration.status === 'FAIL') {
    ranking.push({
      rank: rank++,
      suspect: 'Tool not registered in runtime path',
      probability: 'CRITICAL',
      fix: 'Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.',
    })
    next.push(`Fix tool registration FIRST — no other check matters until runtime tool path is wired.`)
  } else if (toolRegistration.status === 'WARN') {
    ranking.push({
      rank: rank++,
      suspect: 'Ultravox stored tools stale (runtime via clients.tools is OK)',
      probability: 'LOW (cosmetic)',
      fix: 'Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.',
    })
  }

  if (pgvectorContent.status === 'FAIL') {
    const empty = pgvectorContent.scenarios.filter(s => s.resultCount === 0).map(s => s.scenario.id)
    ranking.push({
      rank: rank++,
      suspect: `Corpus gaps — ${empty.length}/${pgvectorContent.scenarios.length} scenarios return zero results (${empty.join(', ')})`,
      probability: 'HIGH (for gap scenarios)',
      fix: 'Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.',
    })
    next.push('Reseed corpus for the empty-result scenarios.')
  } else if (pgvectorContent.status === 'WARN') {
    const gaps = pgvectorContent.scenarios.filter(s => !s.matchedAny).map(s => s.scenario.id)
    ranking.push({
      rank: rank++,
      suspect: `Partial corpus coverage — ${gaps.length} scenarios returned chunks but content did not match expected patterns (${gaps.join(', ')})`,
      probability: 'MEDIUM',
      fix: 'Review the top chunk content for the gap scenarios — may be a scenario-pattern mismatch (update mustMatchAny in scenarios.ts) or a corpus refinement need.',
    })
  }

  if (promptDrift.status === 'WARN') {
    ranking.push({
      rank: rank++,
      suspect: 'DB ↔ Ultravox prompt drift',
      probability: 'MEDIUM',
      fix: 'Call updateAgent(agentId, agentFlags) to push DB prompt to Ultravox. Investigate why drift occurred (failed updateAgent? manual edit? hand_tuned bypass?).',
    })
  }

  if (promptBloat.status === 'FAIL') {
    ranking.push({
      rank: rank++,
      suspect: `Prompt-bloat instruction fatigue (${report.deployedChars.toLocaleString()}c + ${promptBloat.instructionPositions.length} tool instructions)`,
      probability: 'HIGH',
      fix: 'A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.',
    })
    if (report.handTuned) {
      next.push('Phase 2d niche-defaults compression is the critical path. Phase 2b alone will not help — recompose currently rejects this client at >12K.')
    } else {
      next.push('Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.')
    }
  } else if (promptBloat.status === 'WARN') {
    ranking.push({
      rank: rank++,
      suspect: `Prompt over 12K target (${report.deployedChars.toLocaleString()}c)`,
      probability: 'MEDIUM',
      fix: 'Consider compression. Lower priority if other checks pass.',
    })
  }

  if (ranking.length === 0) {
    ranking.push({
      rank: 1,
      suspect: 'No diagnostic-layer suspects — all 4 checks PASS',
      probability: 'n/a',
      fix: 'If knowledge routing is still misbehaving in production, escalate to Layer 2 (text-grade) or Layer 3 (live-replay) harness for response-quality regression.',
    })
    next.push('Run Layer 2 text-grade harness to grade verbal routing behavior.')
  }

  return { ranking, nextActions: next }
}

// ── Output rendering ─────────────────────────────────────────────────────────
function renderMarkdown(report: AuditReport): string {
  const lines: string[] = []
  const fmt = (s: CheckResult['status']) => ({ PASS: '✅', WARN: '🟠', FAIL: '🔴', SKIP: '⏭️' }[s])
  lines.push(`# Knowledge-Routing Audit — ${report.slug}`)
  lines.push('')
  lines.push(`**Generated:** ${report.generatedAt}`)
  lines.push(`**Audit version:** ${report.auditVersion}`)
  lines.push(`**Git:** ${report.gitSha} on \`${report.gitBranch}\`${report.gitDirty ? ' (dirty working tree)' : ''}`)
  lines.push(`**Client:** ${report.slug} (${canonicalNiche(report.niche) ?? 'unknown niche'})`)
  lines.push(`**Agent ID:** ${report.agentId ?? '(none)'}`)
  lines.push(`**Deployed prompt:** ${report.deployedChars.toLocaleString()} chars · hand_tuned=${report.handTuned}`)
  lines.push(`**Knowledge backend:** ${report.knowledgeBackend ?? 'null'} · approved chunks: ${report.approvedChunkCount}`)
  lines.push('')
  lines.push('## Check Results')
  lines.push('')
  lines.push(`### ${fmt(report.checks.toolRegistration.status)} Check 1 — Tool Registration`)
  lines.push(report.checks.toolRegistration.summary)
  lines.push('')
  for (const d of report.checks.toolRegistration.details) lines.push(`  ${d}`)
  lines.push('')
  lines.push(`### ${fmt(report.checks.pgvectorContent.status)} Check 2 — pgvector Content`)
  lines.push(report.checks.pgvectorContent.summary)
  lines.push('')
  for (const d of report.checks.pgvectorContent.details) lines.push(`  ${d}`)
  lines.push('')
  lines.push(`### ${fmt(report.checks.promptDrift.status)} Check 3 — DB ↔ Ultravox Prompt Drift`)
  lines.push(report.checks.promptDrift.summary)
  lines.push('')
  for (const d of report.checks.promptDrift.details) lines.push(`  ${d}`)
  lines.push('')
  lines.push(`### ${fmt(report.checks.promptBloat.status)} Check 4 — Prompt-Bloat Instruction Fatigue`)
  lines.push(report.checks.promptBloat.summary)
  lines.push('')
  for (const d of report.checks.promptBloat.details) lines.push(`  ${d}`)
  lines.push('')
  lines.push('## Suspect Ranking')
  lines.push('')
  for (const s of report.suspectRanking) {
    lines.push(`**${s.rank}. ${s.suspect}** — probability: ${s.probability}`)
    lines.push(`   → Fix: ${s.fix}`)
    lines.push('')
  }
  lines.push('## Next Actions')
  lines.push('')
  for (const a of report.nextActions) lines.push(`- ${a}`)
  if (report.nextActions.length === 0) lines.push('_(none — audit clean)_')
  return lines.join('\n')
}

function renderConsole(report: AuditReport): string {
  const lines: string[] = []
  const sym = (s: CheckResult['status']) => ({ PASS: 'PASS ✓', WARN: 'WARN ⚠', FAIL: 'FAIL ✗', SKIP: 'SKIP -' }[s])
  const bar = '═'.repeat(72)
  lines.push(bar)
  lines.push(`KNOWLEDGE-ROUTING AUDIT — ${report.slug}`)
  lines.push(bar)
  lines.push('')
  lines.push(`Client:      ${report.slug} (${report.niche ?? 'unknown'})`)
  lines.push(`Agent ID:    ${report.agentId ?? '(none)'}`)
  lines.push(`Deployed:    ${report.deployedChars.toLocaleString()} chars · hand_tuned=${report.handTuned}`)
  lines.push(`KB backend:  ${report.knowledgeBackend ?? 'null'} · approved chunks: ${report.approvedChunkCount}`)
  lines.push('')
  for (const [name, check] of [
    ['Check 1 — Tool Registration', report.checks.toolRegistration],
    ['Check 2 — pgvector Content', report.checks.pgvectorContent],
    ['Check 3 — Prompt Drift', report.checks.promptDrift],
    ['Check 4 — Prompt Bloat', report.checks.promptBloat],
  ] as const) {
    lines.push(`[${sym(check.status)}] ${name}`)
    lines.push(`         ${check.summary}`)
    for (const d of check.details) lines.push(`         ${d}`)
    lines.push('')
  }
  lines.push('SUSPECT RANKING')
  lines.push('─'.repeat(72))
  for (const s of report.suspectRanking) {
    lines.push(`  ${s.rank}. ${s.suspect}`)
    lines.push(`     probability: ${s.probability}`)
    lines.push(`     fix: ${s.fix}`)
    lines.push('')
  }
  lines.push('NEXT ACTIONS')
  lines.push('─'.repeat(72))
  if (report.nextActions.length === 0) lines.push('  (none — audit clean)')
  for (const a of report.nextActions) lines.push(`  → ${a}`)
  lines.push('')
  return lines.join('\n')
}

// ── Single client run (returns report + worst status for exit-code logic) ────
async function auditOneClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  slug: string,
  git: GitProvenance,
): Promise<{ report: AuditReport | null; worstStatus: CheckResult['status']; error: string | null }> {
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, slug, niche, business_name, agent_name, system_prompt, knowledge_backend, ultravox_agent_id, tools, hand_tuned')
    .eq('slug', slug)
    .maybeSingle()

  if (clientErr) return { report: null, worstStatus: 'FAIL', error: `DB error: ${clientErr.message}` }
  if (!client) return { report: null, worstStatus: 'FAIL', error: `Client '${slug}' not found` }

  const c = client as ClientRow

  const { count: chunkCount } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', c.id)
    .eq('status', 'approved')

  const ultravoxAgent = c.ultravox_agent_id ? await fetchUltravoxAgent(c.ultravox_agent_id) : null

  const toolRegistration = await checkToolRegistration(c, ultravoxAgent)
  const pgvectorContent = await checkPgvectorContent(c, supabase)
  const promptDrift = await checkPromptDrift(c, ultravoxAgent)
  const promptBloat = checkPromptBloat(c)

  const report: AuditReport = {
    slug: c.slug,
    niche: c.niche,
    agentId: c.ultravox_agent_id,
    deployedChars: (c.system_prompt ?? '').length,
    handTuned: Boolean(c.hand_tuned),
    knowledgeBackend: c.knowledge_backend,
    approvedChunkCount: chunkCount ?? 0,
    checks: { toolRegistration, pgvectorContent, promptDrift, promptBloat },
    suspectRanking: [],
    nextActions: [],
    generatedAt: new Date().toISOString(),
    gitSha: git.sha,
    gitBranch: git.branch,
    gitDirty: git.dirty,
    auditVersion: AUDIT_VERSION,
  }

  const { ranking, nextActions } = rankSuspects(report)
  report.suspectRanking = ranking
  report.nextActions = nextActions

  const worstStatus = [toolRegistration.status, pgvectorContent.status, promptDrift.status, promptBloat.status]
    .reduce<CheckResult['status']>((worst, cur) => {
      const order = { PASS: 0, SKIP: 0, WARN: 1, FAIL: 2 }
      return order[cur] > order[worst] ? cur : worst
    }, 'PASS')

  return { report, worstStatus, error: null }
}

function statusExitCode(worst: CheckResult['status'], strict: boolean): number {
  if (worst === 'FAIL') return 1
  if (worst === 'WARN' && strict) return 1
  return 0
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[audit] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(2)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const git = getGitProvenance()

  // Determine the slug set
  let slugs: string[]
  if (args.all) {
    const { data: fleet, error } = await supabase
      .from('clients')
      .select('slug')
      .not('ultravox_agent_id', 'is', null)
      .order('slug', { ascending: true })
    if (error) {
      console.error(`[audit] Fleet enumeration failed: ${error.message}`)
      process.exit(3)
    }
    slugs = (fleet ?? []).map((c: { slug: string }) => c.slug)
    console.error(`[audit] Fleet mode — auditing ${slugs.length} clients with ultravox_agent_id`)
  } else {
    slugs = [args.slug!]
  }

  const results: Array<{ slug: string; worstStatus: CheckResult['status']; report: AuditReport | null; error: string | null }> = []
  for (const slug of slugs) {
    if (args.all) console.error(`\n[audit] ──── ${slug} ────`)
    const { report, worstStatus, error } = await auditOneClient(supabase, slug, git)
    results.push({ slug, worstStatus, report, error })

    if (error) {
      console.error(`[audit] ${slug}: ${error}`)
      continue
    }
    if (!report) continue

    // Output for this client
    if (args.json && !args.all) {
      console.log(JSON.stringify(report, null, 2))
    } else if (!args.json) {
      console.log(renderConsole(report))
    }

    if (!args.noReport) {
      const date = new Date().toISOString().slice(0, 10)
      const reportPath = args.reportPath && !args.all
        ? resolve(args.reportPath)
        : resolve(process.cwd(), `tests/promptfoo/knowledge-routing/reports/${report.slug}-${date}.md`)
      mkdirSync(dirname(reportPath), { recursive: true })
      writeFileSync(reportPath, renderMarkdown(report), 'utf8')
      console.error(`[audit] Markdown report written → ${reportPath}`)
    }
  }

  // Fleet-mode JSON aggregate
  if (args.json && args.all) {
    console.log(JSON.stringify({
      mode: 'fleet',
      auditedAt: new Date().toISOString(),
      git,
      auditVersion: AUDIT_VERSION,
      clients: results.map(r => ({ slug: r.slug, worstStatus: r.worstStatus, report: r.report, error: r.error })),
    }, null, 2))
  }

  // Fleet summary table (always shown in fleet mode unless --json)
  if (args.all && !args.json) {
    console.log('\n' + '═'.repeat(72))
    console.log('FLEET SUMMARY')
    console.log('═'.repeat(72))
    const sym = (s: CheckResult['status']) => ({ PASS: '✓', WARN: '⚠', FAIL: '✗', SKIP: '-' }[s])
    console.log('slug                              tools  kb    drift  bloat  worst')
    console.log('─'.repeat(72))
    for (const r of results) {
      if (!r.report) {
        console.log(`${r.slug.padEnd(33)} ERROR: ${r.error}`)
        continue
      }
      const c = r.report.checks
      console.log(
        `${r.slug.padEnd(33)} ` +
        `  ${sym(c.toolRegistration.status)}    ` +
        ` ${sym(c.pgvectorContent.status)}    ` +
        ` ${sym(c.promptDrift.status)}    ` +
        ` ${sym(c.promptBloat.status)}    ` +
        ` ${r.worstStatus}`
      )
    }
    console.log('')
  }

  // Exit code = worst across all audited clients
  const worstAcrossFleet = results.reduce<CheckResult['status']>((worst, cur) => {
    const order = { PASS: 0, SKIP: 0, WARN: 1, FAIL: 2 }
    return order[cur.worstStatus] > order[worst] ? cur.worstStatus : worst
  }, 'PASS')

  process.exit(statusExitCode(worstAcrossFleet, args.strict))
}

main().catch(e => {
  console.error('[audit] fatal:', e instanceof Error ? e.stack ?? e.message : String(e))
  process.exit(3)
})
