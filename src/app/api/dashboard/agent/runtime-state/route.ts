/**
 * GET /api/dashboard/agent/runtime-state — D447 Phase 1
 *
 * Returns the deployed Ultravox agent's actual state alongside the DB row,
 * with a per-field divergence array explaining any mismatches.
 *
 * The Overview Greeting tile binds to `runtime.deployed.greeting` so that
 * "what I see on Overview = what the agent will actually say on the next
 * call" — which is Brian's literal complaint.
 *
 * Behavior:
 * - Auth-gated like other dashboard routes (`client_users` lookup).
 * - Feature-flag gated by `OVERVIEW_RUNTIME_TRUTH_ENABLED`. When unset/false
 *   the route returns DB values + `syncStatus: 'unknown'` and skips the
 *   upstream Ultravox call entirely. Default-off path is byte-identical to
 *   "Ultravox unreachable" so the UI fallback is exercised by both.
 * - 60s in-memory LRU cache per `clientId`, single-flight on cache miss.
 * - Hard 3s timeout on the upstream Ultravox GET. Returns DB-only + warn log
 *   on timeout/5xx/401. Never blocks the Overview render.
 *
 * Out of scope for Phase 1 (deferred to follow-up):
 * - Wiring `QuickConfigStrip` and `CapabilitiesCard`.
 * - Per-field "Saved but not live yet" chip on PATCH (that's D448 / D369).
 * - Tools-list divergence chip (return shape includes the data, but the
 *   AgentIdentityCard tile only consumes `field === 'greeting'` entries).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  classifyDivergence,
  extractGreetingFromPrompt,
  normalizeForCompare,
  withRuntimeStateCache,
  type DivergenceEntry,
  type SyncStatus,
} from '@/lib/agent-runtime-state'
import { buildAgentTools } from '@/lib/ultravox'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import { normalizeToolNames } from '@/lib/tool-name-extractor'

export const dynamic = 'force-dynamic'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'
const ULTRAVOX_TIMEOUT_MS = 3_000

// ── Response shape (matches Tracker/D447 §"Files / New") ─────────────────────

interface RuntimeStateResponse {
  deployed: {
    greeting: string | null
    voiceId: string | null
    tools: string[]
    systemPromptCharCount: number
    lastSyncedAt: string | null
  }
  db: {
    greeting: string | null
    voiceId: string | null
    tools: string[]
    systemPromptCharCount: number
  }
  syncStatus: SyncStatus
  syncError: string | null
  divergence: DivergenceEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isFlagEnabled(): boolean {
  return process.env.OVERVIEW_RUNTIME_TRUTH_ENABLED === 'true'
}

interface UltravoxAgentResponse {
  callTemplate?: {
    systemPrompt?: string
    voice?: string
    selectedTools?: unknown[]
  }
}

async function fetchUltravoxAgent(
  agentId: string,
  apiKey: string,
): Promise<UltravoxAgentResponse | null> {
  try {
    const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(ULTRAVOX_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(
        `[runtime-state] Ultravox GET /agents/${agentId} returned ${res.status}`,
      )
      return null
    }
    return (await res.json()) as UltravoxAgentResponse
  } catch (err) {
    console.warn(
      `[runtime-state] Ultravox GET /agents/${agentId} failed:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // CRITICAL: client_users uses .limit(1).maybeSingle() — admins have
  // multiple rows. Never use .single() here. (Per CLAUDE.md standing rule.)
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  // Admin can scope to a specific client via ?client_id=
  const adminClientId = req.nextUrl.searchParams.get('client_id')
  const targetClientId =
    cu.role === 'admin' && adminClientId ? adminClientId : cu.client_id

  // Fetch the DB row. Use .maybeSingle() so a missing row returns 404
  // instead of a 500.
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select(
      [
        'system_prompt',
        'agent_voice_id',
        'tools',
        'last_agent_sync_status',
        'last_agent_sync_error',
        'last_agent_sync_at',
        'ultravox_agent_id',
        'selected_plan',
        'subscription_status',
        'niche',
        'slug',
        'booking_enabled',
        'sms_enabled',
        'forwarding_number',
        'transfer_conditions',
        'twilio_number',
        'knowledge_backend',
      ].join(','),
    )
    .eq('id', targetClientId)
    .maybeSingle()

  if (clientErr || !clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const row = clientRow as unknown as {
    system_prompt: string | null
    agent_voice_id: string | null
    tools: unknown[] | null
    last_agent_sync_status: string | null
    last_agent_sync_error: string | null
    last_agent_sync_at: string | null
    ultravox_agent_id: string | null
    selected_plan: string | null
    subscription_status: string | null
    niche: string | null
    slug: string | null
    booking_enabled: boolean | null
    sms_enabled: boolean | null
    forwarding_number: string | null
    transfer_conditions: string | null
    twilio_number: string | null
    knowledge_backend: string | null
  }

  // ── Build the DB-side view (always available, no upstream needed) ────────
  const dbPrompt = row.system_prompt ?? ''
  const dbGreeting = extractGreetingFromPrompt(dbPrompt)
  const dbToolsRaw = Array.isArray(row.tools) ? row.tools : []
  const dbTools = normalizeToolNames(dbToolsRaw, {
    source: `runtime-state db clients.tools slug=${row.slug ?? targetClientId}`,
  })

  const dbSyncStatusRaw = row.last_agent_sync_status
  const syncStatus: SyncStatus =
    dbSyncStatusRaw === 'success' || dbSyncStatusRaw === 'error'
      ? dbSyncStatusRaw
      : 'unknown'

  const dbSection = {
    greeting: dbGreeting,
    voiceId: row.agent_voice_id,
    tools: dbTools,
    systemPromptCharCount: dbPrompt.length,
  }

  // ── Fast paths: feature flag off OR no agent ID configured ───────────────
  // Both behave the same: return DB-only with syncStatus='unknown' so the
  // UI's `useRuntimeGreeting` gate (`syncStatus !== 'unknown'`) skips the
  // runtime render and falls through to the legacy DB-driven path. This is
  // what guarantees default-off behavior is byte-identical to the pre-D447
  // Overview render.
  if (!isFlagEnabled() || !row.ultravox_agent_id) {
    const response: RuntimeStateResponse = {
      deployed: {
        greeting: dbGreeting,
        voiceId: row.agent_voice_id,
        tools: dbTools,
        systemPromptCharCount: dbPrompt.length,
        lastSyncedAt: row.last_agent_sync_at,
      },
      db: dbSection,
      syncStatus: 'unknown',
      syncError: row.last_agent_sync_error,
      divergence: [],
    }
    return NextResponse.json(response)
  }

  // ── Slow path: hit Ultravox (cached) ─────────────────────────────────────
  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    // Misconfiguration: fall back to DB-only rather than 500. Log loudly.
    console.warn('[runtime-state] ULTRAVOX_API_KEY not set — returning DB-only')
    const response: RuntimeStateResponse = {
      deployed: {
        greeting: dbGreeting,
        voiceId: row.agent_voice_id,
        tools: dbTools,
        systemPromptCharCount: dbPrompt.length,
        lastSyncedAt: row.last_agent_sync_at,
      },
      db: dbSection,
      syncStatus: 'unknown',
      syncError: row.last_agent_sync_error,
      divergence: [],
    }
    return NextResponse.json(response)
  }

  const agentId = row.ultravox_agent_id

  const upstream = await withRuntimeStateCache(targetClientId, () =>
    fetchUltravoxAgent(agentId, apiKey),
  )

  if (!upstream) {
    // Ultravox unreachable. Stale-while-revalidate: render DB values, mark
    // the call site so the UI can show "couldn't reach live agent" if it
    // wants to. We don't surface the error string — it's an internal detail.
    const response: RuntimeStateResponse = {
      deployed: {
        greeting: dbGreeting,
        voiceId: row.agent_voice_id,
        tools: dbTools,
        systemPromptCharCount: dbPrompt.length,
        lastSyncedAt: row.last_agent_sync_at,
      },
      db: dbSection,
      syncStatus: 'unknown',
      syncError: row.last_agent_sync_error,
      divergence: [],
    }
    return NextResponse.json(response)
  }

  // ── Parse Ultravox response ──────────────────────────────────────────────
  const ct = upstream.callTemplate ?? {}
  const runtimePrompt = ct.systemPrompt ?? ''
  const runtimeGreeting = extractGreetingFromPrompt(runtimePrompt)
  const runtimeVoice = ct.voice ?? null
  const runtimeToolsRaw = Array.isArray(ct.selectedTools) ? ct.selectedTools : []
  const runtimeTools = normalizeToolNames(runtimeToolsRaw, {
    source: `runtime-state ultravox selectedTools slug=${row.slug ?? targetClientId}`,
  })

  // ── Build divergence list ────────────────────────────────────────────────
  const divergence: DivergenceEntry[] = []

  // Greeting divergence — the Phase 1 high-signal field.
  // Normalize both sides before extraction-comparison so cosmetic marker /
  // whitespace diffs (D447 risk #3) don't false-positive.
  const dbGreetingForCompare = dbGreeting ?? ''
  const runtimeGreetingForCompare = runtimeGreeting ?? ''
  const greetingEntry = classifyDivergence({
    field: 'greeting',
    db: dbGreetingForCompare,
    runtime: runtimeGreetingForCompare,
    syncStatus,
    // greeting is editable in the registry — the only `fake_control` case
    // here would be if someone marks GREETING_LINE editable:false in the
    // future. Pass undefined to leave the classifier free to decide.
  })
  if (greetingEntry) divergence.push(greetingEntry)

  // Voice divergence — simple equality, no marker stripping needed.
  if ((row.agent_voice_id ?? '') !== (runtimeVoice ?? '')) {
    const voiceEntry = classifyDivergence({
      field: 'voice',
      db: row.agent_voice_id ?? '',
      runtime: runtimeVoice ?? '',
      syncStatus,
    })
    if (voiceEntry) divergence.push(voiceEntry)
  }

  // Tools divergence — sort on both sides (already done in helper).
  // `clients.tools` IS the runtime-authoritative source for production calls
  // (per Architecture/Control-Plane-Mutation-Contract §7 Risk 7), so a
  // mismatch with Ultravox stored selectedTools is expected when settings
  // PATCH hasn't run `updateAgent()` since the last `syncClientTools()`.
  // We still surface it because for the dashboard test-call path (no
  // overrideTools), the stored tools ARE what runs.
  if (
    dbTools.length !== runtimeTools.length ||
    dbTools.some((t, i) => t !== runtimeTools[i])
  ) {
    // Plan-gating check: was this tool stripped because the plan excludes it?
    const plan = getPlanEntitlements(
      row.subscription_status === 'trialing' ? 'trial' : row.selected_plan,
    )
    // What `buildAgentTools()` would produce given the current plan — used
    // to detect "DB has flag but plan-gated" vs "DB has flag and plan allows".
    const expectedTools = normalizeToolNames(
      buildAgentTools({
        slug: row.slug ?? undefined,
        booking_enabled: row.booking_enabled ?? false,
        sms_enabled: row.sms_enabled ?? false,
        forwarding_number: row.forwarding_number ?? undefined,
        transfer_conditions: row.transfer_conditions ?? undefined,
        twilio_number: row.twilio_number ?? undefined,
        knowledge_backend: row.knowledge_backend ?? undefined,
        knowledge_chunk_count: 1, // approximation — we don't fetch count here
        selectedPlan: row.selected_plan ?? undefined,
        subscriptionStatus: row.subscription_status ?? undefined,
        niche: row.niche ?? undefined,
      }),
      { source: `runtime-state generated tools slug=${row.slug ?? targetClientId}` },
    )
    // If the DB has a capability flag set but `expectedTools` (plan-gated)
    // doesn't include it, that's plan_gated rather than partial_failure.
    const dbHasMore = dbTools.filter(t => !expectedTools.includes(t)).length > 0
    const planGated = !plan.bookingEnabled || !plan.transferEnabled || !plan.smsEnabled
      ? dbHasMore
      : false

    const toolsEntry = classifyDivergence({
      field: 'tools',
      db: dbTools.join(','),
      runtime: runtimeTools.join(','),
      syncStatus,
      planGated,
    })
    if (toolsEntry) divergence.push(toolsEntry)
  }

  // SystemPrompt divergence — large surface, useful as a backstop signal.
  if (normalizeForCompare(dbPrompt) !== normalizeForCompare(runtimePrompt)) {
    const promptEntry = classifyDivergence({
      field: 'systemPrompt',
      // Keep the actual values short so the response stays small — the chip
      // doesn't expand the full prompt. Owner-facing detail surfaces via
      // greeting/voice/tools entries.
      db: `${dbPrompt.length} chars`,
      runtime: `${runtimePrompt.length} chars`,
      syncStatus,
    })
    if (promptEntry) divergence.push(promptEntry)
  }

  // ── Build response ───────────────────────────────────────────────────────
  const response: RuntimeStateResponse = {
    deployed: {
      greeting: runtimeGreeting,
      voiceId: runtimeVoice,
      tools: runtimeTools,
      systemPromptCharCount: runtimePrompt.length,
      lastSyncedAt: row.last_agent_sync_at,
    },
    db: dbSection,
    syncStatus,
    syncError: row.last_agent_sync_error,
    divergence,
  }
  return NextResponse.json(response)
}
