/**
 * D452 — Weekly drift detection cron.
 *
 * For each active client: dry-run recomposePrompt() and compare the regenerated
 * prompt against the stored clients.system_prompt. Insert one row per client
 * into client_drift_log.
 *
 * Read-only. Never mutates clients.system_prompt or calls Ultravox.
 *
 * Run locally:
 *   npx tsx scripts/drift-check-all.ts
 *
 * Run weekly via Railway cron (config in railway.json or dashboard).
 */

import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import { parsePromptSections } from '../src/lib/prompt-sections'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

type SectionDelta = { sectionId: string; storedChars: number; newChars: number; delta: number }

function computeSectionDeltas(stored: string, recomposed: string): SectionDelta[] {
  const storedSections = parsePromptSections(stored)
  const recomposedSections = parsePromptSections(recomposed)
  const allIds = new Set([...Object.keys(storedSections), ...Object.keys(recomposedSections)])

  const deltas: SectionDelta[] = []
  for (const sectionId of allIds) {
    const s = (storedSections[sectionId] ?? '').length
    const n = (recomposedSections[sectionId] ?? '').length
    if (s === n) continue
    deltas.push({ sectionId, storedChars: s, newChars: n, delta: n - s })
  }
  return deltas
}

function summarize(deltas: SectionDelta[]): { biggestDropSection: string | null; summary: string } {
  if (deltas.length === 0) return { biggestDropSection: null, summary: 'no section changes' }

  // Sort by delta ascending → most negative (biggest drop) first
  const sorted = [...deltas].sort((a, b) => a.delta - b.delta)
  const biggestDrop = sorted[0]
  const drops = sorted.filter(d => d.delta < 0)

  const parts: string[] = [`${deltas.length} section${deltas.length === 1 ? '' : 's'} changed`]
  if (biggestDrop.delta < 0) {
    parts.push(`biggest drop: ${biggestDrop.sectionId} (${biggestDrop.delta.toLocaleString()})`)
  } else {
    parts.push(`net additive (no drops)`)
  }
  if (drops.length > 1) parts.push(`${drops.length} sections lost content`)

  return {
    biggestDropSection: biggestDrop.delta < 0 ? biggestDrop.sectionId : null,
    summary: parts.join('; '),
  }
}

type DriftRow = {
  client_id: string
  stored_chars: number | null
  recomposed_chars: number | null
  chars_dropped: number | null
  chars_added: number | null
  pct_change: number | null
  biggest_drop_section: string | null
  diff_summary: string | null
  status: 'ok' | 'legacy_monolithic' | 'error'
  error_message: string | null
}

async function checkClient(client: { id: string; slug: string; system_prompt: string | null }): Promise<DriftRow> {
  const stored = client.system_prompt ?? ''
  const result = await recomposePrompt(client.id, null, true, false)

  if (!result.success) {
    const isLegacy = (result.error ?? '').includes('Old-format prompt without section markers')
    return {
      client_id: client.id,
      stored_chars: stored.length,
      recomposed_chars: null,
      chars_dropped: null,
      chars_added: null,
      pct_change: null,
      biggest_drop_section: null,
      diff_summary: isLegacy ? 'snowflake — recompose blocked, awaiting D445 migration' : (result.error ?? 'unknown error'),
      status: isLegacy ? 'legacy_monolithic' : 'error',
      error_message: result.error ?? null,
    }
  }

  // Slot pipeline path. promptChanged=false → zero drift. preview only present when promptChanged=true.
  if (!result.promptChanged) {
    return {
      client_id: client.id,
      stored_chars: stored.length,
      recomposed_chars: stored.length,
      chars_dropped: 0,
      chars_added: 0,
      pct_change: 0,
      biggest_drop_section: null,
      diff_summary: 'no drift',
      status: 'ok',
      error_message: null,
    }
  }

  const recomposed = result.preview ?? ''
  const deltas = computeSectionDeltas(stored, recomposed)
  const charsDropped = deltas.reduce((sum, d) => sum + (d.delta < 0 ? -d.delta : 0), 0)
  const charsAdded = deltas.reduce((sum, d) => sum + (d.delta > 0 ? d.delta : 0), 0)
  const pctChange = stored.length > 0 ? Number(((Math.abs(recomposed.length - stored.length) / stored.length) * 100).toFixed(2)) : 0
  const { biggestDropSection, summary } = summarize(deltas)

  return {
    client_id: client.id,
    stored_chars: stored.length,
    recomposed_chars: recomposed.length,
    chars_dropped: charsDropped,
    chars_added: charsAdded,
    pct_change: pctChange,
    biggest_drop_section: biggestDropSection,
    diff_summary: summary,
    status: 'ok',
    error_message: null,
  }
}

async function main() {
  const startedAt = Date.now()
  console.log('[drift-check] Starting weekly drift scan…')

  const { data: clients, error } = await sb
    .from('clients')
    .select('id, slug, business_name, system_prompt, status')
    .eq('status', 'active')
    .order('business_name')

  if (error) {
    console.error('[drift-check] Failed to load clients:', error.message)
    process.exit(1)
  }
  if (!clients || clients.length === 0) {
    console.log('[drift-check] No active clients.')
    return
  }

  console.log(`[drift-check] Scanning ${clients.length} active clients…`)
  const rows: DriftRow[] = []
  for (const client of clients) {
    const c = client as { id: string; slug: string; business_name: string; system_prompt: string | null }
    try {
      const row = await checkClient(c)
      rows.push(row)
      const tag =
        row.status === 'legacy_monolithic' ? 'SNOWFLAKE' :
        row.status === 'error' ? 'ERROR' :
        (row.chars_dropped ?? 0) > 500 ? 'HIGH' :
        (row.chars_dropped ?? 0) > 100 ? 'MED' : 'OK'
      const dropStr = row.chars_dropped !== null ? `${row.chars_dropped.toLocaleString()} chars dropped` : '—'
      console.log(`  [${tag.padEnd(9)}] ${c.business_name.padEnd(32)} ${dropStr}`)
    } catch (err) {
      console.error(`  [CRASH    ] ${c.business_name}: ${err instanceof Error ? err.message : String(err)}`)
      rows.push({
        client_id: c.id,
        stored_chars: (c.system_prompt ?? '').length,
        recomposed_chars: null,
        chars_dropped: null,
        chars_added: null,
        pct_change: null,
        biggest_drop_section: null,
        diff_summary: null,
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const { error: insertErr } = await sb.from('client_drift_log').insert(rows)
  if (insertErr) {
    console.error('[drift-check] Insert failed:', insertErr.message)
    process.exit(1)
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  const ok = rows.filter(r => r.status === 'ok').length
  const high = rows.filter(r => r.status === 'ok' && (r.chars_dropped ?? 0) > 500).length
  const snowflake = rows.filter(r => r.status === 'legacy_monolithic').length
  const errored = rows.filter(r => r.status === 'error').length
  console.log(`\n[drift-check] Done in ${durationSec}s. ok=${ok} high-drift=${high} snowflake=${snowflake} error=${errored}`)
}

main().catch(err => {
  console.error('[drift-check] Fatal:', err)
  process.exit(1)
})
