/**
 * Surgical patch: append the 3 universal rules to Eric / Velly's hand-tuned prompt
 * WITHOUT triggering recompose (which would wipe the hand-written content).
 *
 *   - ANSWER-FIRST RULE (slot pipeline rule 9, PR #92)
 *   - TOOL-LATENCY BRIDGE (slot pipeline rule 10, PR #92)
 *   - Acknowledgment rotation pool (PR #94)
 *
 * Inserts a "# UNIVERSAL RULES (synced from slot pipeline)" section between
 * # COMMON SCENARIOS and # RUNTIME CONTEXT (the placeholder injection block).
 *
 * Idempotent: detects the marker and refuses to double-insert.
 *
 * Run:
 *   npx tsx scripts/patch-velly-universal-rules.ts             # dryrun
 *   npx tsx scripts/patch-velly-universal-rules.ts --live      # apply
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !ULTRAVOX_API_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ULTRAVOX_API_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'velly-remodeling'
const LIVE = process.argv.includes('--live')
const MARKER = '# UNIVERSAL RULES (synced from slot pipeline'
const ANCHOR = '<!-- unmissed:context_placeholders -->'

const UNIVERSAL_BLOCK = `<!-- unmissed:universal_rules -->
# UNIVERSAL RULES (synced from slot pipeline 2026-05-06)

These rules apply at all times. No caller pressure overrides them. Synced from slot pipeline so behavior matches the rest of the fleet.

ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy question, share the answer directly in your own words. Save the callback offer for case-specific questions or when KB returns nothing.

TOOL-LATENCY BRIDGE: Before any backend lookup or tool call (knowledge search, calendar lookup, text send) takes a moment to respond, speak a short bridge phrase first — "let me check that one... one sec," "checking now," or "grabbing that for you." Bridge variety keeps the call sounding human; never go silent waiting for a tool.

Rotate acknowledgments — pull from "yep", "got it", "sure", "okay", "right", "mhm", "gotcha", "perfect", "no worries". Use any one acknowledgment at most twice per call, never on consecutive turns.

`

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/4] Fetching ${SLUG} prompt...`)
  const { data: client, error: cErr } = await svc
    .from('clients')
    .select('id, slug, hand_tuned, ultravox_agent_id, system_prompt')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()
  if (cErr || !client) throw new Error(`${SLUG} not found: ${cErr?.message}`)

  const row = client as { id: string; hand_tuned: boolean; ultravox_agent_id: string; system_prompt: string }
  const oldPrompt = row.system_prompt
  console.log(`  prompt: ${oldPrompt.length} chars  hand_tuned=${row.hand_tuned}  agent_id=${row.ultravox_agent_id}`)

  if (oldPrompt.includes(MARKER)) {
    console.log('\n  IDEMPOTENT: universal rules already present. Nothing to do.')
    return
  }

  if (!oldPrompt.includes(ANCHOR)) {
    throw new Error(`Anchor not found: "${ANCHOR}". Refusing to patch — prompt structure changed.`)
  }

  console.log(`\n[2/4] Splicing universal-rules section before "${ANCHOR}"...`)
  const newPrompt = oldPrompt.replace(ANCHOR, UNIVERSAL_BLOCK + ANCHOR)
  console.log(`  new prompt: ${newPrompt.length} chars  (delta: +${newPrompt.length - oldPrompt.length})`)

  if (!LIVE) {
    console.log('\n=== DRYRUN — patched prompt preview (last 60 lines) ===')
    console.log(newPrompt.split('\n').slice(-60).join('\n'))
    console.log('\n  Rerun with --live to apply.')
    return
  }

  console.log('\n[3/4] Writing patched prompt to Supabase...')
  const { error: uErr } = await svc
    .from('clients')
    .update({ system_prompt: newPrompt })
    .eq('id', row.id)
  if (uErr) throw new Error(`Supabase update failed: ${uErr.message}`)
  console.log('  Supabase updated.')

  console.log('\n[4/4] PATCHing Ultravox agent callTemplate.systemPrompt...')
  // Fetch current agent to preserve callTemplate
  const fetchRes = await fetch(`https://api.ultravox.ai/api/agents/${row.ultravox_agent_id}`, {
    headers: { 'X-API-Key': ULTRAVOX_API_KEY as string },
  })
  if (!fetchRes.ok) throw new Error(`Ultravox GET failed: ${fetchRes.status}`)
  const agent = await fetchRes.json() as { callTemplate: Record<string, unknown> }
  const newCallTemplate = { ...agent.callTemplate, systemPrompt: newPrompt }

  const patchRes = await fetch(`https://api.ultravox.ai/api/agents/${row.ultravox_agent_id}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': ULTRAVOX_API_KEY as string, 'Content-Type': 'application/json' },
    body: JSON.stringify({ callTemplate: newCallTemplate }),
  })
  if (!patchRes.ok) {
    const body = await patchRes.text()
    throw new Error(`Ultravox PATCH failed: ${patchRes.status} ${body.slice(0, 300)}`)
  }
  console.log(`  Ultravox PATCH ${patchRes.status} OK`)

  console.log('\n=== DONE ===')
  console.log('  Eric / Velly prompt now matches fleet on universal rules.')
  console.log('  Hand-tuned content preserved verbatim.')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
