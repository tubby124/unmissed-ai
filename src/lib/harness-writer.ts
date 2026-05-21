/**
 * harness-writer — one upsert API every harness uses to record findings.
 *
 * Each finding is keyed by (harness_name, check_name, client_slug). Re-runs
 * that produce identical findings UPDATE last_seen_at on the existing row —
 * dashboard reads "the latest snapshot of every finding still being reported"
 * rather than an append-only event stream.
 *
 * Resolution flow:
 *   - Admin clicks "Resolve" in /admin/harness → UPDATE status='resolved'
 *   - Next harness run that no longer reports the finding does NOT touch the
 *     row. The row stays resolved.
 *   - If the same finding RE-APPEARS, recordFindings() flips status back to
 *     'open' and bumps last_seen_at — admin gets re-notified.
 *
 * Suppression: admin can suppressed_until=<date>, which the read query filters
 * out. Useful for "known issue, fix queued".
 *
 * Note: this module talks to Supabase via SUPABASE_SERVICE_ROLE_KEY which
 * bypasses RLS. The table's RLS policies only gate dashboard reads / admin
 * resolutions — writes are always service-role.
 */

import { createClient } from '@supabase/supabase-js'

export type Severity = 'P0' | 'P1' | 'P2' | 'PASS'
export type Status = 'open' | 'resolved' | 'suppressed'

export type HarnessName =
  | 'data-hygiene'
  | 'drift-check'
  | 'stripe-drift'
  | 'twilio-ownership'
  | 'prompt-injection'
  | 'schemathesis'
  | 'promptfoo'

export interface Finding {
  /** Sub-check identifier within the harness. Stable, kebab-case. */
  check_name: string
  /** P0/P1/P2 for issues. PASS for explicit greens (rare — usually omit). */
  severity: Severity
  /** Client this finding is about, if any. NULL for fleet-wide findings. */
  client_slug?: string | null
  /** One-line human description. Goes in Telegram + dashboard list. */
  summary: string
  /** Free-form structured payload. Goes in dashboard expand-row. */
  details?: Record<string, unknown>
}

export interface RecordFindingsInput {
  harness: HarnessName
  /** Unique per run. Typically `${GITHUB_RUN_ID || Date.now()}`. */
  run_id: string
  findings: Finding[]
}

export interface RecordFindingsResult {
  written: number
  reopened: number
  errors: string[]
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'harness-writer requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars. ' +
      'In GH Actions: pass via `env:` block from secrets.'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Upsert findings into harness_findings.
 *
 * Behavior:
 *   - Existing row matched on (harness, check_name, client_slug): UPDATE
 *     last_seen_at, run_id, summary, details, severity. If row was 'resolved'
 *     and we're re-reporting it, flip status back to 'open' (re-notify).
 *   - No matching row: INSERT new with status='open'.
 *
 * Does NOT delete findings that weren't included in this run. Use
 * markRunComplete() if you want auto-close-stale behavior (TBD).
 */
export async function recordFindings(input: RecordFindingsInput): Promise<RecordFindingsResult> {
  const sb = getClient()
  const result: RecordFindingsResult = { written: 0, reopened: 0, errors: [] }

  for (const f of input.findings) {
    const slug = f.client_slug ?? null
    const { data: existing, error: selectErr } = await sb
      .from('harness_findings')
      .select('id, status')
      .eq('harness_name', input.harness)
      .eq('check_name', f.check_name)
      .is('client_slug', slug as null)
      // PostgREST .is() requires literal null, not undefined
      .maybeSingle()

    if (selectErr) {
      result.errors.push(`select failed for ${f.check_name}/${slug}: ${selectErr.message}`)
      continue
    }

    if (existing) {
      const willReopen = existing.status === 'resolved'
      const { error: updateErr } = await sb
        .from('harness_findings')
        .update({
          last_seen_at: new Date().toISOString(),
          run_id: input.run_id,
          summary: f.summary,
          details: f.details ?? {},
          severity: f.severity,
          status: willReopen ? 'open' : existing.status,
          resolved_at: willReopen ? null : undefined,
          resolved_by: willReopen ? null : undefined,
        })
        .eq('id', existing.id)
      if (updateErr) {
        result.errors.push(`update failed for ${f.check_name}/${slug}: ${updateErr.message}`)
      } else {
        result.written++
        if (willReopen) result.reopened++
      }
    } else {
      const { error: insertErr } = await sb.from('harness_findings').insert({
        harness_name: input.harness,
        run_id: input.run_id,
        check_name: f.check_name,
        client_slug: slug,
        severity: f.severity,
        summary: f.summary,
        details: f.details ?? {},
        status: 'open',
      })
      if (insertErr) {
        result.errors.push(`insert failed for ${f.check_name}/${slug}: ${insertErr.message}`)
      } else {
        result.written++
      }
    }
  }

  return result
}

/**
 * Convenience for harnesses that report a single all-clear when no issues
 * found. Writes one PASS row keyed to the harness itself — dashboard uses
 * this to render the "last successful run" timestamp per harness.
 */
export async function recordHealthyRun(harness: HarnessName, run_id: string, summary = 'No findings'): Promise<void> {
  await recordFindings({
    harness,
    run_id,
    findings: [
      { check_name: '_healthy_run_marker', severity: 'PASS', summary, client_slug: null },
    ],
  })
}
