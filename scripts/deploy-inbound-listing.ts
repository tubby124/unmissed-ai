/**
 * scripts/deploy-inbound-listing.ts
 *
 * Deploys the inbound listing-lookup feature for a client:
 *   1. clients.listing_search_url ← --search-url
 *   2. clients.system_prompt     ← clients/{slug}/SYSTEM_PROMPT.txt
 *   3. syncClientTools()          → rebuilds clients.tools (runtime truth)
 *   4. updateAgent()              → Ultravox stored prompt + tools (Agents API path)
 *
 * Safety rails:
 *   - Extracts the X-Tool-Secret from the CURRENT prod clients.tools and forces
 *     process.env.WEBHOOK_SIGNING_SECRET to match before rebuilding — a local
 *     env mismatch would otherwise 401 every tool on the next call.
 *   - Asserts the rebuilt tools include lookupListing and that every HTTP tool
 *     still carries the secret. Aborts (no Ultravox PATCH) otherwise.
 *
 * Usage:
 *   npx tsx scripts/deploy-inbound-listing.ts --slug hasan-sharif \
 *     --search-url https://hasansharif.ca/api/listings/search [--dry-run]
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

function arg(flag: string, dflt?: string): string | undefined {
  const args = process.argv.slice(2)
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const DRY = process.argv.includes('--dry-run')

type ToolShape = {
  temporaryTool?: {
    modelToolName?: string
    staticParameters?: { name: string; value?: string }[]
  }
  toolName?: string
}

function toolName(t: ToolShape): string {
  return t.toolName ?? t.temporaryTool?.modelToolName ?? 'unknown'
}

function extractSecret(tools: ToolShape[]): string | undefined {
  for (const t of tools) {
    const p = t.temporaryTool?.staticParameters?.find(s => s.name === 'X-Tool-Secret')
    if (p?.value) return p.value
  }
  return undefined
}

async function main() {
  const slug = arg('--slug', 'hasan-sharif')!
  const searchUrl = arg('--search-url', 'https://hasansharif.ca/api/listings/search')!

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client, error } = await svc
    .from('clients')
    .select('id, slug, niche, ultravox_agent_id, agent_voice_id, tools, booking_enabled, forwarding_number, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, system_prompt')
    .eq('slug', slug)
    .single()
  if (error || !client) throw new Error(`client lookup failed: ${error?.message}`)
  if (!client.ultravox_agent_id) throw new Error('client has no ultravox_agent_id — Agents API path required')

  // Secret parity guard — current prod tools are the source of truth
  const currentTools = (client.tools ?? []) as ToolShape[]
  const prodSecret = extractSecret(currentTools)
  if (prodSecret && process.env.WEBHOOK_SIGNING_SECRET !== prodSecret) {
    console.log('WEBHOOK_SIGNING_SECRET in env differs from prod tools — using prod value for rebuild')
    process.env.WEBHOOK_SIGNING_SECRET = prodSecret
  }
  if (!process.env.WEBHOOK_SIGNING_SECRET) throw new Error('No WEBHOOK_SIGNING_SECRET available (env empty and none found in current tools)')

  // Import AFTER the env fix so module-level reads (none today, but cheap insurance) see it
  const { updateAgent } = await import('../src/lib/ultravox')
  const { syncClientTools } = await import('../src/lib/sync-client-tools')

  const promptPath = resolve(`clients/${slug}/SYSTEM_PROMPT.txt`)
  const prompt = readFileSync(promptPath, 'utf8').trim()
  if (!prompt.includes('{{callerContext}}')) throw new Error('prompt missing {{callerContext}} placeholder')
  if (!prompt.includes('lookupListing')) throw new Error('prompt does not reference lookupListing — wrong file?')
  if (prompt.length > 25_300) throw new Error(`prompt over hard max: ${prompt.length} chars`)

  console.log(`slug=${slug}`)
  console.log(`prompt: ${prompt.length} chars (was ${(client.system_prompt as string | null)?.length ?? 0})`)
  console.log(`listing_search_url: ${searchUrl}`)
  console.log(`current tools: ${currentTools.map(toolName).join(', ')}`)
  if (DRY) { console.log('\n--dry-run: no writes performed'); return }

  // 1+2 — DB writes
  const { error: upErr } = await svc
    .from('clients')
    .update({ system_prompt: prompt, listing_search_url: searchUrl })
    .eq('id', client.id)
  if (upErr) throw new Error(`clients update failed: ${upErr.message}`)
  console.log('✓ clients.system_prompt + listing_search_url updated')

  // 3 — rebuild clients.tools (runtime truth for toolOverrides)
  await syncClientTools(svc, client.id as string)
  const { data: after } = await svc.from('clients').select('tools').eq('id', client.id).single()
  const newTools = (after?.tools ?? []) as ToolShape[]
  const names = newTools.map(toolName)
  console.log(`✓ clients.tools rebuilt: ${names.join(', ')}`)
  if (!names.includes('lookupListing')) throw new Error('rebuilt tools missing lookupListing — aborting before Ultravox PATCH')
  for (const t of newTools) {
    if (t.temporaryTool && extractSecret([t]) !== process.env.WEBHOOK_SIGNING_SECRET) {
      throw new Error(`tool ${toolName(t)} lost its X-Tool-Secret — aborting before Ultravox PATCH`)
    }
  }

  // 4 — Ultravox stored agent (prompt for Agents API calls + stored tools)
  const { count } = await svc
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('status', 'approved')

  await updateAgent(client.ultravox_agent_id as string, {
    systemPrompt: prompt,
    voice: client.agent_voice_id as string | null,
    slug,
    niche: client.niche as string | null,
    booking_enabled: client.booking_enabled ?? false,
    forwarding_number: (client.forwarding_number as string | null) || undefined,
    transfer_conditions: (client.transfer_conditions as string | null) || undefined,
    sms_enabled: client.sms_enabled ?? false,
    twilio_number: (client.twilio_number as string | null) || undefined,
    knowledge_backend: (client.knowledge_backend as string | null) || undefined,
    knowledge_chunk_count: count ?? 0,
    selectedPlan: (client.selected_plan as string | null) || undefined,
    subscriptionStatus: (client.subscription_status as string | null) || undefined,
    listing_search_url: searchUrl,
  })
  console.log('✓ Ultravox agent PATCHed (prompt + tools)')
  console.log('\nDEPLOYED. Next inbound call runs the new prompt with lookupListing.')
}

main().catch(err => {
  console.error('deploy-inbound-listing failed:', err)
  process.exit(1)
})
