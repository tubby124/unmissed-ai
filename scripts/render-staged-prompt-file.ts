/**
 * Renders the windshield-hub staged slot prompt (with templateContext
 * placeholders resolved against real DB state) to a static file that
 * promptfoo can read via `file://...` reference.
 *
 * Output: clients/windshield-hub/SYSTEM_PROMPT_STAGED.txt
 *
 * Run: npx tsx scripts/render-staged-prompt-file.ts
 * Then: promptfoo eval -c tests/promptfoo/windshield-hub-staged.yaml
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { buildAgentContext, type ClientRow } from '../src/lib/agent-context'
import * as fs from 'node:fs'
import * as path from 'node:path'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const SLUG = 'windshield-hub'
const DRYRUN_PATH = 'CALLINGAGENTS/00-Inbox/windshield-hub-snowflake-dryrun.json'
const OUT_PATH = `clients/${SLUG}/SYSTEM_PROMPT_STAGED.txt`

async function main() {
  const dryrun = JSON.parse(fs.readFileSync(DRYRUN_PATH, 'utf-8')) as { preview: string; success: boolean }
  if (!dryrun.success) throw new Error('dryrun success=false — re-run dryrun first')
  let staged = dryrun.preview

  const { data: client } = await svc
    .from('clients')
    .select('id, slug, niche, business_name, agent_voice_id, ' +
      'context_data, context_data_label, business_facts, extra_qa, timezone, ' +
      'business_hours_weekday, business_hours_weekend, after_hours_behavior, ' +
      'after_hours_emergency_phone, knowledge_backend, injected_note')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (!client) throw new Error(`client ${SLUG} not found`)
  const c = client as unknown as Record<string, unknown>

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
  const callerContextRaw = ctx.assembled.callerContextBlock.slice(1, -1)
  let knowledgeBlockStr = ctx.knowledge.block
  if (ctx.retrieval.enabled && ctx.retrieval.promptInstruction) {
    knowledgeBlockStr = knowledgeBlockStr
      ? `${knowledgeBlockStr}\n\n${ctx.retrieval.promptInstruction}`
      : ctx.retrieval.promptInstruction
  }
  staged = staged
    .replace(/\{\{callerContext\}\}/g, callerContextRaw)
    .replace(/\{\{businessFacts\}\}/g, knowledgeBlockStr)
    .replace(/\{\{extraQa\}\}/g, '')
    .replace(/\{\{contextData\}\}/g, ctx.assembled.contextDataBlock)

  fs.writeFileSync(path.resolve(OUT_PATH), staged)
  console.log(`wrote ${OUT_PATH}: ${staged.length} chars`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
