/**
 * test-prompt-live.ts — Canonical "live test without notifying" for any client.
 *
 * What it does:
 *   1. Reads the target client's live system_prompt + tools + voice from Supabase
 *   2. Resolves {{callerContext}} / {{businessFacts}} / {{contextData}} via the
 *      same buildAgentContext() production inbound uses (synthetic +15555550100)
 *   3. POSTs to Ultravox /api/calls with selectedTools = HANGUP_TOOL + client.tools
 *   4. NO callbackUrl → NO post-call webhook → NO Telegram/SMS/email to owner
 *   5. NO call_logs insert → no Calls-page noise
 *   6. Spins up a local http server, writes joinUrl into public/test-prompt-live.html,
 *      opens browser. WebRTC call begins, you talk, hang up.
 *   7. Polls Ultravox /calls/{id} until ended, fetches transcript + tool invocations
 *   8. Greps for per-slug hallucination markers, counts bridge phrases + tool calls
 *   9. Writes report to tests/promptfoo/live-tests/<slug>-<timestamp>.json
 *
 * Usage:
 *   npx tsx scripts/test-prompt-live.ts --slug calgary-property-leasing
 *   npx tsx scripts/test-prompt-live.ts --slug urban-vibe --max-seconds 90
 *   npx tsx scripts/test-prompt-live.ts --slug velly-remodeling --markers "Edmonton,Sutherland"
 *
 * Why this exists:
 *   The promptfoo harness uses Groq Llama 70b as a proxy. Catches ~80% of bugs
 *   but doesn't perfectly predict GLM-4.6 behavior on Ultravox. For 100%
 *   production fidelity we need a real Ultravox call. PSTN (calling the number)
 *   triggers the owner's notification pipeline. This script bypasses that.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { buildAgentContext, type ClientRow } from '../src/lib/agent-context'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as http from 'node:http'
import { spawn } from 'node:child_process'

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function arg(name: string, fallback?: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  return fallback
}

const SLUG = arg('slug', 'calgary-property-leasing')!
const MAX_SECONDS = parseInt(arg('max-seconds', '180')!, 10)
const SYNTHETIC_PHONE = arg('caller', '+15555550100')!
const MARKERS_RAW = arg('markers')
const NO_OPEN = args.includes('--no-open')
// --prompt-file <path>: override the DB-loaded system_prompt with the file's
// contents. Used to A/B-test a proposed prompt (e.g. slot-pipeline regen)
// against the current live one without writing to DB or PATCHing Ultravox.
// Tools, voice, and runtime context (caller, hours, KB) still come from DB.
const PROMPT_FILE = arg('prompt-file')

// Per-slug default hallucination markers — substrings that, if they appear in
// the agent's output, indicate a REAL regression (not a verified KB answer).
//
// LESSON 2026-06-03: Do NOT include client-truth strings as markers. Brian's
// KB confirms "Calgary and Edmonton" as his coverage. Flagging "Edmonton" as
// a hallucination produced a false positive when the agent correctly read
// back the verified KB chunk. Markers must reflect things the client does
// NOT cover / does NOT offer / has NOT confirmed.
const DEFAULT_MARKERS: Record<string, string[]> = {
  // Brian covers Calgary + Edmonton (KB-verified). Hallucination markers =
  // utilities-included claim (the real next-target bug), invented neighborhoods
  // OUTSIDE his coverage, or invented dollar figures.
  'calgary-property-leasing': ['heat is included', 'water is included', 'all utilities', 'most of our units include', 'Vancouver', 'Toronto'],
  // Urban Vibe is Calgary-only PM. Edmonton would actually be wrong here.
  'urban-vibe': ['Edmonton', 'Vancouver', 'heat is included', 'pet deposit', 'most of our units include'],
  // Windshield Hub auto_glass — invented specific quote amounts only.
  'windshield-hub': ['$50 fee', '$75 fee', 'fully covered', 'lifetime warranty', 'zero deductible for you'],
  // Hasan-sharif real_estate — RECA exposure = specific commission %.
  'hasan-sharif': ['5% commission', '3.5%', '4%', 'usually 5%', 'typically 5%'],
  // Velly home_renovation — invented Saskatoon neighborhoods + invented $ rates.
  'velly-remodeling': ['Sutherland', 'Nutana', 'Riversdale', '$200/sqft', 'per square foot', '$15,000', '$20,000'],
}
const markers = MARKERS_RAW
  ? MARKERS_RAW.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_MARKERS[SLUG] || []

// ── Env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ULTRAVOX_KEY = process.env.ULTRAVOX_API_KEY
const ULTRAVOX_BASE = process.env.ULTRAVOX_BASE || 'https://api.ultravox.ai/api'

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env')
if (!ULTRAVOX_KEY) throw new Error('Missing ULTRAVOX_API_KEY in .env.local')

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const OUT_DIR = path.resolve('tests/promptfoo/live-tests')
const HTML_PATH = path.resolve('public/test-prompt-live.html')

// ── Helpers ─────────────────────────────────────────────────────────────────
async function ultravox(method: string, p: string, body?: unknown): Promise<any> {
  const res = await fetch(`${ULTRAVOX_BASE}${p}`, {
    method,
    headers: {
      'X-API-Key': ULTRAVOX_KEY!,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox ${method} ${p} failed: ${res.status} ${err}`)
  }
  return res.json()
}

async function staticServer(port: number, root: string): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/'
      const filePath = path.join(root, url.split('?')[0])
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return }
        const ext = path.extname(filePath)
        const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain'
        res.writeHead(200, { 'Content-Type': type })
        res.end(data)
      })
    })
    server.on('error', reject)
    server.listen(port, () => resolve(server))
  })
}

function openInBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref()
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[1/7] Looking up ${SLUG}…`)
  const { data: client, error } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, timezone, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone, business_facts, extra_qa, context_data, context_data_label, knowledge_backend, injected_note, injected_note_expires_at, service_areas, system_prompt, agent_voice_id, tools, ultravox_agent_id')
    .eq('slug', SLUG)
    .single()

  if (error || !client) throw new Error(`Client ${SLUG} not found: ${error?.message}`)

  console.log(`    id=${client.id}`)
  console.log(`    niche=${client.niche}`)
  console.log(`    system_prompt: ${client.system_prompt?.length || 0} chars`)
  console.log(`    tools: ${Array.isArray(client.tools) ? client.tools.length : 0}`)
  console.log(`    voice: ${client.agent_voice_id || '(default)'}`)
  console.log(`    markers being checked: ${markers.length ? markers.join(', ') : '(none)'}`)

  console.log(`\n[2/7] Building agent context (synthetic caller ${SYNTHETIC_PHONE})…`)
  const clientRow: ClientRow = {
    id: client.id,
    slug: client.slug,
    niche: client.niche ?? undefined,
    business_name: client.business_name ?? undefined,
    timezone: client.timezone ?? undefined,
    business_hours_weekday: client.business_hours_weekday ?? undefined,
    business_hours_weekend: client.business_hours_weekend ?? undefined,
    after_hours_behavior: client.after_hours_behavior ?? undefined,
    after_hours_emergency_phone: client.after_hours_emergency_phone ?? undefined,
    business_facts: client.business_facts ?? undefined,
    extra_qa: (client.extra_qa as { q: string; a: string }[] | null) ?? undefined,
    context_data: client.context_data ?? undefined,
    context_data_label: client.context_data_label ?? undefined,
    knowledge_backend: client.knowledge_backend ?? undefined,
    injected_note: client.injected_note ?? undefined,
    injected_note_expires_at: client.injected_note_expires_at ?? undefined,
    service_areas: (client.service_areas as string[] | null) ?? undefined,
  }
  const corpusAvailable = client.knowledge_backend === 'pgvector'
  const ctx = buildAgentContext(clientRow, SYNTHETIC_PHONE, [], new Date(), corpusAvailable, [])

  console.log(`\n[3/7] Resolving template placeholders…`)
  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  // Source the base prompt — either from DB (default) or from --prompt-file
  // (used to validate a proposed prompt before writing to DB).
  let promptSource = 'DB (live)'
  let basePrompt = client.system_prompt as string
  if (PROMPT_FILE) {
    if (!fs.existsSync(PROMPT_FILE)) {
      throw new Error(`--prompt-file path does not exist: ${PROMPT_FILE}`)
    }
    basePrompt = fs.readFileSync(PROMPT_FILE, 'utf8')
    promptSource = `FILE: ${PROMPT_FILE}`
  }
  let systemPrompt = basePrompt
    .replace(/\{\{callerContext\}\}/g, callerContextRaw)
    .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
    .replace(/\{\{extraQa\}\}/g, '')
    .replace(/\{\{contextData\}\}/g, contextDataBlock)

  // Append explicit test marker so the agent treats this as a synthetic test
  systemPrompt += `\n\n[TEST MODE — synthetic caller ${SYNTHETIC_PHONE}. NO Twilio number. NO post-call webhook. NO owner notification. This is a prompt validation call.]`

  console.log(`    prompt source: ${promptSource}`)
  console.log(`    resolved system_prompt: ${systemPrompt.length} chars`)

  console.log(`\n[4/7] Creating Ultravox call (WebRTC, no callbackUrl, no medium.twilio)…`)
  // client.tools is the runtime-authoritative source (per docs/architecture/
  // control-plane-mutation-contract.md). It already includes hangUp + every
  // gated tool the agent should have at runtime. Pass as-is.
  function toolName(t: any): string {
    if (t?.toolName) return String(t.toolName)
    if (t?.nameOverride) return String(t.nameOverride)
    if (t?.temporaryTool?.modelToolName) return String(t.temporaryTool.modelToolName)
    return ''
  }
  const rawTools = Array.isArray(client.tools) ? (client.tools as any[]) : []
  const dedupedTools: any[] = []
  const seen = new Set<string>()
  for (const t of rawTools) {
    const n = toolName(t)
    if (!n || seen.has(n)) continue
    seen.add(n)
    dedupedTools.push(t)
  }
  // Ensure hangUp is present (it should always be, but belt-and-suspenders)
  if (!seen.has('hangUp')) dedupedTools.unshift({ toolName: 'hangUp' })

  const body: Record<string, unknown> = {
    model: 'ultravox-v0.7',
    systemPrompt,
    voice: client.agent_voice_id || undefined,
    maxDuration: `${MAX_SECONDS}s`,
    recordingEnabled: true,
    firstSpeakerSettings: { agent: { uninterruptible: true } },
    selectedTools: dedupedTools,
    metadata: {
      source: 'test-prompt-live',
      slug: SLUG,
      synthetic_caller: SYNTHETIC_PHONE,
    },
  }
  const created = await ultravox('POST', '/calls', body)
  const callId = created.callId as string
  const joinUrl = created.joinUrl as string

  console.log(`    callId=${callId}`)
  console.log(`    joinUrl=${joinUrl.slice(0, 80)}…`)

  console.log(`\n[5/7] Spinning up local http server + opening browser…`)
  if (!fs.existsSync(HTML_PATH)) {
    throw new Error(`HTML scaffold not found at ${HTML_PATH} — must exist before script runs.`)
  }
  const port = 38001 + Math.floor(Math.random() * 100)
  const server = await staticServer(port, path.resolve('public'))
  const browserUrl = `http://localhost:${port}/test-prompt-live.html#joinUrl=${encodeURIComponent(joinUrl)}&callId=${callId}&slug=${SLUG}&maxSeconds=${MAX_SECONDS}`
  console.log(`    serving public/ on http://localhost:${port}`)
  console.log(`    browser url: ${browserUrl}`)
  if (!NO_OPEN) openInBrowser(browserUrl)

  console.log(`\n[6/7] Polling Ultravox for call end (max ${MAX_SECONDS + 30}s)…`)
  const startedAt = Date.now()
  const timeoutAt = startedAt + (MAX_SECONDS + 30) * 1000
  let callMeta: any = null
  while (Date.now() < timeoutAt) {
    await sleep(4000)
    try {
      callMeta = await ultravox('GET', `/calls/${callId}`)
      const ended = callMeta?.ended || callMeta?.endedAt || callMeta?.endReason
      if (ended) {
        console.log(`    call ended after ${Math.round((Date.now() - startedAt) / 1000)}s — endReason=${callMeta.endReason || '?'}`)
        break
      }
      process.stdout.write('.')
    } catch (e) {
      // transient — keep polling
    }
  }
  process.stdout.write('\n')
  server.close()

  console.log(`\n[7/7] Fetching transcript + tool invocations…`)
  const msgs = await ultravox('GET', `/calls/${callId}/messages`)
  const messages: any[] = msgs.results || msgs.messages || []

  const transcriptLines: string[] = []
  let toolInvocations = 0
  let queryKnowledgeFires = 0
  let bridgePhraseHits = 0
  const markersHit: string[] = []
  const BRIDGE_PATTERNS = /let me (check|grab|look)|one sec|give me a sec|checking that|grabbing that/i

  for (const m of messages) {
    const role = m.role || m.speaker || 'unknown'
    const text = (m.text || m.content || '') as string
    if (text) transcriptLines.push(`[${role}] ${text}`)
    if (role === 'MESSAGE_ROLE_AGENT' || role === 'agent') {
      if (BRIDGE_PATTERNS.test(text)) bridgePhraseHits++
      for (const mk of markers) {
        if (text.toLowerCase().includes(mk.toLowerCase())) {
          markersHit.push(`${mk} in: "${text.slice(0, 100)}"`)
        }
      }
    }
    if (m.toolName || m.role === 'MESSAGE_ROLE_TOOL_CALL' || m.role === 'tool_call') {
      toolInvocations++
      const toolName = (m.toolName || m.text || '') as string
      if (toolName.toLowerCase().includes('queryknowledge')) queryKnowledgeFires++
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  // Report filename embeds prompt source so baseline vs proposed are visually distinct.
  const sourceTag = PROMPT_FILE ? `proposed-${path.basename(PROMPT_FILE, path.extname(PROMPT_FILE))}` : 'baseline-db'
  const outPath = path.join(OUT_DIR, `${SLUG}-${sourceTag}-${stamp}.json`)
  const report = {
    slug: SLUG,
    promptSource: PROMPT_FILE ? { type: 'file', path: PROMPT_FILE } : { type: 'db', source: 'clients.system_prompt' },
    callId,
    startedAt: new Date(startedAt).toISOString(),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    systemPromptChars: systemPrompt.length,
    voice: client.agent_voice_id || null,
    toolsCount: Array.isArray(client.tools) ? client.tools.length : 0,
    markers,
    metrics: {
      bridgePhraseHits,
      toolInvocations,
      queryKnowledgeFires,
      markersHit,
    },
    transcript: transcriptLines,
    rawMessages: messages,
  }
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(`\n═══ RESULT ═══`)
  console.log(`  bridge phrases:      ${bridgePhraseHits}`)
  console.log(`  tool invocations:    ${toolInvocations}`)
  console.log(`  queryKnowledge fires: ${queryKnowledgeFires}`)
  console.log(`  hallucination markers hit: ${markersHit.length}`)
  if (markersHit.length) {
    for (const h of markersHit) console.log(`    ✗ ${h}`)
  } else {
    console.log(`    ✓ none of [${markers.join(', ')}] appeared in agent output`)
  }
  console.log(`\n  report saved: ${outPath}`)
}

main().catch(err => { console.error(err); process.exit(1) })
