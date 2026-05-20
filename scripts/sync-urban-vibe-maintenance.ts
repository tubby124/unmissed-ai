/**
 * One-off: re-sync urban-vibe's Ultravox selectedTools to pick up the maintenance tool.
 *
 * Origin: 2026-05-19 incident audit. Code fix in 7535770 made `buildAgentTools` accept
 * `niche='property-management'` (hyphenated, urban-vibe's actual niche) in addition to
 * `property_management`. Before that fix, urban-vibe never got submitMaintenanceRequest
 * registered. Drift detector confirmed: urban-vibe agent has 6 tools, no maintenance.
 *
 * This script calls `syncClientTools(svc, urbanVibeId)` which:
 *  1. Reads urban-vibe's current state from clients table
 *  2. Calls buildAgentTools() with niche-fixed logic → returns 7 tools including maintenance
 *  3. Writes new tools array to clients.tools (jsonb)
 *  4. Calls updateAgent() — which (post-7535770) carries forward live systemPrompt
 *
 * Risk: LOW. Post-7535770 updateAgent preserves prompt on tool-only syncs. Drift detector
 * verifies before/after counts.
 *
 * Run:
 *   railway run -- npx tsx scripts/sync-urban-vibe-maintenance.ts
 *   OR (with .env.local SUPABASE_SERVICE_ROLE_KEY):
 *   npx tsx scripts/sync-urban-vibe-maintenance.ts
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { syncClientTools } from '../src/lib/sync-client-tools'

const URBAN_VIBE_ID = '42a66c19-e4c0-4cd7-a86e-7e7df711043b'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(2)
  }
  const svc = createClient(url, key, { auth: { persistSession: false } })

  console.log('[sync-urban-vibe-maintenance] Reading current state…')
  const { data: before, error: beforeErr } = await svc
    .from('clients')
    .select('id, slug, niche, ultravox_agent_id, tools')
    .eq('id', URBAN_VIBE_ID)
    .single()
  if (beforeErr || !before) {
    console.error('Failed to read urban-vibe row:', beforeErr)
    process.exit(2)
  }
  const beforeToolCount = Array.isArray(before.tools) ? before.tools.length : 0
  console.log(`[sync-urban-vibe-maintenance] BEFORE: slug=${before.slug} niche=${before.niche} agent=${before.ultravox_agent_id} tool_count=${beforeToolCount}`)

  console.log('[sync-urban-vibe-maintenance] Calling syncClientTools…')
  await syncClientTools(svc, URBAN_VIBE_ID)

  const { data: after } = await svc
    .from('clients')
    .select('tools, last_agent_sync_at, last_agent_sync_status, last_agent_sync_error')
    .eq('id', URBAN_VIBE_ID)
    .single()

  const afterToolCount = Array.isArray(after?.tools) ? (after?.tools as unknown[]).length : 0
  console.log(`[sync-urban-vibe-maintenance] AFTER: tool_count=${afterToolCount} sync_status=${after?.last_agent_sync_status} sync_at=${after?.last_agent_sync_at}`)
  if (after?.last_agent_sync_error) {
    console.error(`[sync-urban-vibe-maintenance] sync_error=${after.last_agent_sync_error}`)
  }
  const toolNames = (after?.tools as Array<Record<string, unknown>> | null)?.map(t => {
    const tt = t.temporaryTool as Record<string, unknown> | undefined
    return (tt?.modelToolName as string) ?? (t.nameOverride as string) ?? '(unknown)'
  }) ?? []
  console.log(`[sync-urban-vibe-maintenance] Tools registered: ${toolNames.join(', ')}`)

  if (!toolNames.includes('submitMaintenanceRequest')) {
    console.error('[sync-urban-vibe-maintenance] FAIL: submitMaintenanceRequest still not in tools after sync. Exit 1.')
    process.exit(1)
  }
  console.log('[sync-urban-vibe-maintenance] OK: submitMaintenanceRequest is now registered for urban-vibe.')
}

main().catch(e => {
  console.error('[sync-urban-vibe-maintenance] FATAL:', e)
  process.exit(2)
})
