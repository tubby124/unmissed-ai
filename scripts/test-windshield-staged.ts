/**
 * D445 Windshield-Hub Staged Prompt Test Call
 *
 * Creates a WebRTC test call using the slot-composed prompt from the dryrun
 * output WITHOUT touching production. Zero impact on:
 *   - clients.system_prompt (Mark's hand-tuned 8,586-char prompt stays live)
 *   - Ultravox agent 00652ba8 (Mark's production agent stays on hand-tuned)
 *   - clients.tools (runtime authoritative, untouched)
 *
 * Uses the same path as /api/dashboard/browser-test-call:
 *   - createDemoCall() — ephemeral WebRTC call
 *   - buildAgentContext() — same context resolution as production inbound
 *   - Resolves {{callerContext}}, {{businessFacts}}, {{contextData}} placeholders
 *   - Passes Mark's actual tools (queryKnowledge, sendTextMessage, hangUp)
 *     so KB queries hit real production KB, SMS fires through real webhook
 *   - Logs to call_logs as call_status='test' for /review-call
 *
 * Usage:
 *   npx tsx scripts/test-windshield-staged.ts                   # default: scenario="general"
 *   npx tsx scripts/test-windshield-staged.ts insurance         # tags call as "insurance" scenario
 *   npx tsx scripts/test-windshield-staged.ts pricing-civic     # tags call as "pricing-civic"
 *
 * Output: a joinUrl. Open it in a browser (Chrome/Safari) to talk to the
 * agent. Browser will prompt for mic permission. After hanging up, run:
 *   /review-call <callId>   to score it.
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { createDemoCall } from '../src/lib/ultravox'
import { buildAgentContext, type ClientRow } from '../src/lib/agent-context'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { exec } from 'node:child_process'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('missing supabase env'); process.exit(1) }

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SLUG = 'windshield-hub'
const DRYRUN_PATH = 'CALLINGAGENTS/00-Inbox/windshield-hub-snowflake-dryrun.json'

const scenarioTag = (process.argv[2] || 'general').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 30)

async function main() {
  console.log(`[1/5] Loading staged slot-composed prompt from ${DRYRUN_PATH}...`)
  if (!fs.existsSync(DRYRUN_PATH)) {
    throw new Error(`dryrun output missing — run scripts/dryrun-windshield-hub.ts first`)
  }
  const dryrun = JSON.parse(fs.readFileSync(DRYRUN_PATH, 'utf-8')) as { preview?: string; success?: boolean }
  if (!dryrun.preview || !dryrun.success) {
    throw new Error(`dryrun preview missing or success=false — re-run dryrun first`)
  }
  let stagedPrompt = dryrun.preview
  console.log(`  staged prompt length: ${stagedPrompt.length} chars`)

  console.log(`[2/5] Fetching ${SLUG} client config + tools...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, agent_voice_id, system_prompt, ' +
      'context_data, context_data_label, business_facts, extra_qa, timezone, ' +
      'business_hours_weekday, business_hours_weekend, after_hours_behavior, ' +
      'after_hours_emergency_phone, knowledge_backend, injected_note, tools')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (clientErr || !client) throw new Error(`client lookup failed: ${clientErr?.message ?? 'not found'}`)
  const c = client as unknown as Record<string, unknown>
  console.log(`  client.id=${c.id}, voice=${c.agent_voice_id}, knowledge_backend=${c.knowledge_backend}`)
  console.log(`  tools count: ${Array.isArray(c.tools) ? (c.tools as unknown[]).length : 0}`)

  console.log(`[3/5] Building agent context (synthetic phone +15555550100, no prior calls)...`)
  const clientRow: ClientRow = {
    id: c.id as string,
    slug: c.slug as string,
    niche: (c.niche as string | null) ?? undefined,
    business_name: (c.business_name as string | null) ?? undefined,
    timezone: (c.timezone as string | null) ?? undefined,
    business_hours_weekday: (c.business_hours_weekday as string | null) ?? undefined,
    business_hours_weekend: (c.business_hours_weekend as string | null) ?? undefined,
    after_hours_behavior: (c.after_hours_behavior as string | null) ?? undefined,
    after_hours_emergency_phone: (c.after_hours_emergency_phone as string | null) ?? undefined,
    business_facts: (c.business_facts as string | null) ?? undefined,
    extra_qa: (c.extra_qa as { q: string; a: string }[] | null) ?? undefined,
    context_data: (c.context_data as string | null) ?? undefined,
    context_data_label: (c.context_data_label as string | null) ?? undefined,
    knowledge_backend: (c.knowledge_backend as string | null) ?? undefined,
    injected_note: (c.injected_note as string | null) ?? undefined,
  }
  const corpusAvailable = (c.knowledge_backend as string | null) === 'pgvector'
  const ctx = buildAgentContext(clientRow, '+15555550100', [], new Date(), corpusAvailable, [])

  // Mirror /api/dashboard/browser-test-call placeholder resolution exactly
  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  const contextDataBlock = ctx.assembled.contextDataBlock

  stagedPrompt = stagedPrompt
    .replace(/\{\{callerContext\}\}/g, callerContextRaw)
    .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
    .replace(/\{\{extraQa\}\}/g, '')
    .replace(/\{\{contextData\}\}/g, contextDataBlock)

  console.log(`  resolved prompt length: ${stagedPrompt.length} chars`)

  // Strip hangUp from tools array — createDemoCall adds HANGUP_TOOL itself
  const rawTools = Array.isArray(c.tools) ? (c.tools as Record<string, unknown>[]) : []
  const tools = rawTools.filter(t => {
    const tn = t.toolName as string | undefined
    const tt = t.temporaryTool as { modelToolName?: string } | undefined
    return tn !== 'hangUp' && tt?.modelToolName !== 'hangUp'
  })
  console.log(`  passing ${tools.length} tools (hangUp filtered, createDemoCall re-adds it)`)

  console.log(`[4/5] Creating ephemeral WebRTC call via createDemoCall()...`)
  const { joinUrl, callId } = await createDemoCall({
    systemPrompt: stagedPrompt,
    voice: (c.agent_voice_id as string) || undefined,
    maxDuration: '600s',
    tools,
  })

  console.log(`[5/5] Logging to call_logs as test call (caller_phone tag: webrtc-staged-d445-${scenarioTag})...`)
  await svc.from('call_logs').insert({
    ultravox_call_id: callId,
    client_id: c.id as string,
    call_status: 'test',
    caller_phone: `webrtc-staged-d445-${scenarioTag}`,
    started_at: new Date().toISOString(),
  })

  // Spawn a one-shot local HTTP server hosting the harness HTML so the
  // ultravox-client SDK can run with mic permission (browsers block
  // getUserMedia on file://).
  const harnessPath = path.resolve('scripts/staged-test-harness.html')
  const harnessHtml = fs.readFileSync(harnessPath, 'utf-8')
  const PORT = 8765
  const harnessUrl = `http://localhost:${PORT}/?joinUrl=${encodeURIComponent(joinUrl)}`

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(harnessHtml)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  server.listen(PORT, () => {
    console.log('')
    console.log('═'.repeat(60))
    console.log('STAGED TEST CALL READY')
    console.log('═'.repeat(60))
    console.log(`  scenario:     ${scenarioTag}`)
    console.log(`  callId:       ${callId}`)
    console.log(`  voice:        Blake (${c.agent_voice_id})`)
    console.log(`  tools:        ${tools.length} prod tools + hangUp`)
    console.log(`  prompt:       slot-composed ${stagedPrompt.length} chars (NOT production)`)
    console.log('')
    console.log(`  joinUrl: ${joinUrl}`)
    console.log(`  Browser: ${harnessUrl}`)
    console.log('')
    console.log(`  → Browser should open automatically (Chrome/Safari).`)
    console.log(`  → Allow mic when prompted, then talk to the staged agent.`)
    console.log(`  → Press Ctrl+C in this terminal when done to stop the local server.`)
    console.log(`  → After hangup, run: /review-call ${callId}`)
    console.log(`  → Production prompt + agent are UNCHANGED — Mark's customers stay on hand-tuned.`)
    console.log('')
    // Auto-open in default browser
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    exec(`${opener} '${harnessUrl}'`, (err) => {
      if (err) console.log(`  (auto-open failed — paste the Browser URL above into your browser manually)`)
    })
  })

  // Keep server alive until Ctrl+C
  process.on('SIGINT', () => {
    console.log('\nshutting down local harness server.')
    server.close(() => process.exit(0))
  })
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
