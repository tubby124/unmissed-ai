#!/usr/bin/env npx tsx
/**
 * backfill-transcripts.ts — Backfill call_transcripts from Ultravox for historical calls.
 *
 * Why: completed_webhook starts writing call_transcripts going forward. For all calls
 *      that ended before that webhook was deployed, we need to retroactively pull the
 *      raw turn-by-turn transcript so the learning bank + niche analyst have material
 *      to mine. call_logs.ai_summary is a compressed Haiku output — not enough.
 *
 * Usage:
 *   npx tsx scripts/backfill-transcripts.ts                          # default --limit 200
 *   npx tsx scripts/backfill-transcripts.ts --limit 50 --dry-run
 *   npx tsx scripts/backfill-transcripts.ts --slug windshield-hub
 *   npx tsx scripts/backfill-transcripts.ts --since 2026-04-01
 *
 * Args:
 *   --limit N        Max number of calls to backfill in this run (default 200).
 *   --dry-run        Print what would be inserted; do not write to DB.
 *   --slug <slug>    Only backfill calls for this client slug.
 *   --since <iso>    Only backfill calls created at/after this ISO date (YYYY-MM-DD).
 *
 * Env (loaded from .env.local at project root):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ULTRAVOX_API_KEY
 *
 * Behavior:
 *   - Selects call_logs rows that have ultravox_call_id, are NOT in (live, processing,
 *     spam, JUNK), and do NOT already have a row in call_transcripts.
 *   - For each row, GET https://api.ultravox.ai/api/calls/{ultravox_call_id}/messages
 *     with X-API-Key header, parses messages with the same filter as
 *     src/lib/ultravox.ts getTranscript() (agent turns + voice-medium user turns).
 *   - Inserts into call_transcripts (idempotent — unique index on ultravox_call_id;
 *     conflicts skipped via .onConflict).
 *   - Rate-limits to ~5 req/sec (200ms delay between calls).
 *   - Per-call timeout 15s. Any single fetch failure is logged + skipped, not fatal.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// ── Env loading ─────────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (!ULTRAVOX_API_KEY) {
  console.error('[backfill] Missing ULTRAVOX_API_KEY in .env.local')
  process.exit(1)
}

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}
const hasFlag = (flag: string) => args.includes(flag)

const limit = parseInt(getArg('--limit') ?? '200', 10)
const dryRun = hasFlag('--dry-run')
const slugFilter = getArg('--slug')
const sinceFilter = getArg('--since')

if (Number.isNaN(limit) || limit <= 0) {
  console.error('[backfill] --limit must be a positive integer')
  process.exit(1)
}

console.log(`[backfill] limit=${limit} dry-run=${dryRun} slug=${slugFilter ?? 'all'} since=${sinceFilter ?? 'none'}`)

// ── Supabase ────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── Types ───────────────────────────────────────────────────────────────────────

interface CallLogRow {
  id: string
  ultravox_call_id: string
  client_id: string | null
  clients?: { slug: string | null } | { slug: string | null }[] | null
}

interface ParsedTurn {
  role: 'agent' | 'user'
  text: string
  timestamp_ms: number | null
}

// ── Ultravox parse — mirrors src/lib/ultravox.ts getTranscript() ────────────────

interface UltravoxMessage {
  role: string
  text?: string
  medium: string
  callStageMessageIndex?: number
  timespan?: { start?: string; end?: string }
}

function parseUltravoxMessages(messages: UltravoxMessage[]): ParsedTurn[] {
  return messages
    .filter((m) => {
      if (typeof m.text !== 'string' || !m.text.trim()) return false
      if (m.role === 'MESSAGE_ROLE_AGENT') return true
      // Exclude Ultravox platform trigger messages — only voice-medium user turns count.
      if (m.role === 'MESSAGE_ROLE_USER') return m.medium === 'MESSAGE_MEDIUM_VOICE'
      return false
    })
    .map((m) => {
      const startStr = m.timespan?.start
      const startSec = startStr != null ? parseFloat(startStr) : NaN
      const timestamp_ms = Number.isFinite(startSec) ? Math.round(startSec * 1000) : null
      return {
        role: m.role === 'MESSAGE_ROLE_AGENT' ? ('agent' as const) : ('user' as const),
        text: m.text!.trim(),
        timestamp_ms,
      }
    })
}

async function fetchUltravoxTranscript(callId: string): Promise<ParsedTurn[] | null> {
  try {
    const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}/messages?pageSize=200`, {
      headers: { 'X-API-Key': ULTRAVOX_API_KEY! },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(`[backfill] HTTP ${res.status} for ${callId}: ${body.slice(0, 200)}`)
      return null
    }
    const data = (await res.json()) as { results?: UltravoxMessage[] }
    return parseUltravoxMessages(data.results || [])
  } catch (err) {
    console.warn(`[backfill] fetch error for ${callId}: ${(err as Error).message}`)
    return null
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeStats(turns: ParsedTurn[]) {
  let agent_chars = 0
  let caller_chars = 0
  for (const t of turns) {
    if (t.role === 'agent') agent_chars += t.text.length
    else caller_chars += t.text.length
  }
  return {
    turn_count: turns.length,
    total_chars: agent_chars + caller_chars,
    agent_chars,
    caller_chars,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // Build query: exclude live/processing/spam/JUNK, must have ultravox_call_id,
  // must NOT already exist in call_transcripts. We filter the "not in transcripts"
  // client-side after pulling candidates because Supabase JS doesn't easily express
  // a NOT-EXISTS subquery. We compensate by fetching candidate IDs first and then
  // pre-filtering.
  let query = supabase
    .from('call_logs')
    .select('id, ultravox_call_id, client_id, created_at, call_status, clients!inner(slug)')
    .not('ultravox_call_id', 'is', null)
    .not('call_status', 'in', '(live,processing,spam,JUNK)')
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 2, 50)) // overfetch — many may already be backfilled

  if (slugFilter) query = query.eq('clients.slug', slugFilter)
  if (sinceFilter) query = query.gte('created_at', sinceFilter)

  const { data: candidates, error: selErr } = await query
  if (selErr) {
    console.error('[backfill] select error:', selErr.message)
    process.exit(1)
  }
  if (!candidates || candidates.length === 0) {
    console.log('[backfill] No candidate calls found.')
    return
  }

  // Filter out calls that already have a transcript.
  const candidateIds = candidates.map((c: { id: string }) => c.id)
  const { data: existing, error: existErr } = await supabase
    .from('call_transcripts')
    .select('call_id')
    .in('call_id', candidateIds)
  if (existErr) {
    console.error('[backfill] existing-check error:', existErr.message)
    process.exit(1)
  }
  const alreadyHave = new Set((existing ?? []).map((r: { call_id: string }) => r.call_id))
  const todo: CallLogRow[] = candidates
    .filter((c: { id: string }) => !alreadyHave.has(c.id))
    .slice(0, limit) as CallLogRow[]

  console.log(`[backfill] candidates=${candidates.length} alreadyHave=${alreadyHave.size} todo=${todo.length}`)

  let backfilled = 0
  let alreadyExisted = alreadyHave.size
  let failed = 0

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i]
    const turns = await fetchUltravoxTranscript(row.ultravox_call_id)
    if (!turns) {
      failed++
      continue
    }
    const stats = computeStats(turns)
    const rowSlug = (row as unknown as { clients?: { slug?: string | null } | { slug?: string | null }[] }).clients
    const slugFromJoin = Array.isArray(rowSlug) ? rowSlug[0]?.slug : rowSlug?.slug
    const slugLabel = slugFromJoin ?? 'unknown'

    if (turns.length === 0) {
      console.log(`[backfill] ${i + 1}/${todo.length} — slug=${slugLabel} call=${row.ultravox_call_id} turns=0 chars=0 (empty — skipping insert)`)
      // Don't insert empty transcripts — they pollute the table. Count as failed for visibility.
      failed++
      await sleep(200)
      continue
    }

    if (dryRun) {
      console.log(`[backfill] ${i + 1}/${todo.length} — DRY — slug=${slugLabel} call=${row.ultravox_call_id} turns=${stats.turn_count} chars=${stats.total_chars}`)
    } else {
      const { error: insErr } = await supabase
        .from('call_transcripts')
        .insert({
          call_id: row.id,
          ultravox_call_id: row.ultravox_call_id,
          client_id: row.client_id,
          slug: slugFromJoin,
          full_transcript: turns,
          turn_count: stats.turn_count,
          total_chars: stats.total_chars,
          agent_chars: stats.agent_chars,
          caller_chars: stats.caller_chars,
          source: 'backfill',
        })

      if (insErr) {
        // Unique-constraint violations on ultravox_call_id (code 23505) = already existed.
        if ((insErr as { code?: string }).code === '23505') {
          alreadyExisted++
          console.log(`[backfill] ${i + 1}/${todo.length} — already-exists slug=${slugLabel} call=${row.ultravox_call_id}`)
        } else {
          failed++
          console.warn(`[backfill] insert failed for ${row.ultravox_call_id}: ${insErr.message}`)
        }
      } else {
        backfilled++
        console.log(`[backfill] ${i + 1}/${todo.length} — slug=${slugLabel} call=${row.ultravox_call_id} turns=${stats.turn_count} chars=${stats.total_chars}`)
      }
    }

    // Rate-limit ~5 req/sec.
    await sleep(200)
  }

  console.log('')
  console.log(`Backfilled ${backfilled}/${todo.length} (${alreadyExisted} already existed, ${failed} failed)${dryRun ? ' [DRY RUN — no inserts]' : ''}`)
}

main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
