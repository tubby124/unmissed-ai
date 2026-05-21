/**
 * calendar-oauth.ts — pure check functions for the calendar-OAuth-validity harness.
 *
 * Why this exists: booking_enabled=true + Google OAuth refresh token revoked
 * is a silent-fail class — the booking tool only learns the token is dead when
 * a real caller tries to book. By that point we've already missed a lead. The
 * runtime book/slots routes do flip clients.calendar_auth_status='expired' on
 * 401 (see src/app/api/calendar/[slug]/{book,slots}/route.ts), but only at
 * call time. This harness exercises the refresh path proactively, daily, so we
 * find revocations within 24h of them happening — not "when a customer
 * complains the booking bot is broken".
 *
 * What this is NOT:
 *   - A token rotator. We never write a new access_token back to the DB. The
 *     module-level cache in src/lib/google-calendar.ts handles that at request
 *     time.
 *   - A mutator of Google Calendar state. Only refresh + optional GET of
 *     /calendars/primary metadata. No event create/delete, no calendar edits.
 *   - A fixer of clients.calendar_auth_status. The runtime routes already flip
 *     it to 'expired' on 401; if we also flipped it from a cron we'd race with
 *     the user's re-authorization flow. Findings stay in harness_findings;
 *     operator triages from /admin/harness.
 *
 * Why split out from scripts/calendar-oauth-check.ts: the classification logic
 * must be unit-testable against synthetic Google responses (no live OAuth
 * client, no network). The script is the IO orchestration layer; this file
 * is the rules.
 *
 * Severity model (maps to harness-writer.ts Severity):
 *   P0 — booking is broken for this client RIGHT NOW (refresh revoked,
 *        calendar deleted) OR our OAuth app itself is broken (401 on
 *        client_credentials — would affect every connected client).
 *   P1 — observable signal, not yet customer-impacting (access_token TTL
 *        unusually short — usually informational).
 *   P2 — transient (Google 5xx) — retry and warn.
 *   PASS — silent.
 */

import type { Severity } from './harness-writer'

// ─── Google OAuth token endpoint response shapes ───────────────────────
// Hand-rolled to keep this file zero-dependency (the script projects fetch
// Response into these shapes before calling the checks).

export interface GoogleTokenSuccess {
  access_token: string
  /** Seconds until access_token expires. Normally 3599. */
  expires_in: number
  scope?: string
  token_type?: string
}

/**
 * Google OAuth token endpoint error body. The 'error' field is the critical
 * one — 'invalid_grant' means the refresh token itself is dead (revoked,
 * expired, or the user removed the grant from their Google account).
 *
 * Reference: https://developers.google.com/identity/protocols/oauth2#errors
 */
export interface GoogleTokenError {
  error: string
  error_description?: string
}

export type RefreshOutcome =
  | { kind: 'ok'; access_token_tail: string; expires_in: number }
  | { kind: 'invalid_grant'; description?: string }
  | { kind: 'invalid_client'; description?: string }
  | { kind: 'transient'; status: number; description?: string }
  | { kind: 'unknown_error'; status: number; description?: string }

/** Optional secondary probe: did the calendar still exist after a successful refresh? */
export type CalendarProbeOutcome =
  | { kind: 'ok' }
  | { kind: 'not_found' }
  | { kind: 'skipped' }
  | { kind: 'error'; status: number; message?: string }

// ─── DB row projection ─────────────────────────────────────────────────

export interface DbClientForCalendarCheck {
  id: string
  slug: string
  /** clients.booking_enabled — must be true to land in this harness's working set. */
  booking_enabled: boolean
  /** clients.calendar_auth_status — typically 'connected' once OAuth completes. */
  calendar_auth_status: string | null
  /** clients.google_refresh_token — never logged. Only used to call Google. */
  google_refresh_token: string | null
  /** clients.google_calendar_id — 'primary' fallback applied at runtime. */
  google_calendar_id: string | null
}

// ─── Finding shape (compatible with harness-writer Finding) ────────────

export interface CalendarOAuthFinding {
  check_name: string
  severity: Severity
  client_slug: string | null
  summary: string
  details: Record<string, unknown>
}

// ─── Constants ─────────────────────────────────────────────────────────

/**
 * Access tokens normally last ~3599s. If Google ever returns a TTL meaningfully
 * shorter than that, something is off (Google degraded mode, or our clock is
 * skewed enough that effective lifetime is short). 30min picked as the
 * "noticeably degraded" floor — well below the normal 3599 but above 0 (we
 * don't want to flag tokens that just happen to be 3500s for clock-skew
 * reasons). Informational only; not customer-impacting.
 */
const NEAR_EXPIRY_THRESHOLD_SECONDS = 30 * 60 // 30 min

/**
 * Fraction of P0 invalid_client errors across the working set above which we
 * escalate to an account-level finding. The interpretation: if our OAuth app
 * credentials are misconfigured/expired/revoked at Google, EVERY client will
 * hit 401 on this check simultaneously. A single 401 is a Google blip; many
 * 401s is "our OAuth client is broken — fix that first, individual revocations
 * second".
 */
export const INVALID_CLIENT_ESCALATION_FRACTION = 0.5

// ─── Classification: HTTP response → RefreshOutcome ────────────────────

/**
 * Classify a Google token-endpoint response.
 *
 * The script layer is responsible for shape-checking the JSON body before
 * passing it here — we accept the parsed object plus the HTTP status.
 *
 * Important: 200 with a body that lacks access_token is treated as
 * unknown_error, not ok. The Google contract guarantees access_token on 200;
 * if it's missing the response is malformed and we don't want to silently
 * trust the refresh.
 */
export function classifyRefreshResponse(
  status: number,
  body: Partial<GoogleTokenSuccess & GoogleTokenError> | null,
): RefreshOutcome {
  if (status >= 200 && status < 300) {
    if (!body || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      return { kind: 'unknown_error', status, description: 'malformed_success_body' }
    }
    return {
      kind: 'ok',
      // Keep only the last 8 chars — never the full token. Used solely for
      // log correlation; never persisted to harness_findings details.
      access_token_tail: body.access_token.slice(-8),
      expires_in: body.expires_in,
    }
  }

  if (status === 400) {
    const err = body?.error
    if (err === 'invalid_grant') {
      return { kind: 'invalid_grant', description: body?.error_description }
    }
    if (err === 'invalid_client') {
      // Google sometimes returns 400 with error='invalid_client' instead of
      // a 401. Treat it the same as a 401 — our OAuth app credentials are
      // the problem, not the user's grant.
      return { kind: 'invalid_client', description: body?.error_description }
    }
    return { kind: 'unknown_error', status, description: body?.error ?? body?.error_description }
  }

  if (status === 401) {
    return { kind: 'invalid_client', description: body?.error_description }
  }

  if (status >= 500 && status < 600) {
    return { kind: 'transient', status, description: body?.error_description }
  }

  return { kind: 'unknown_error', status, description: body?.error ?? body?.error_description }
}

// ─── Per-client finding generation ─────────────────────────────────────

/**
 * Convert (client row, refresh outcome, optional calendar probe) into findings.
 *
 * Caller is responsible for skipping this entirely if booking_enabled !== true
 * or calendar_auth_status !== 'connected' — those rows shouldn't be in the
 * working set in the first place. We re-check defensively but don't emit
 * findings for them; the harness is scoped to "clients where booking is
 * supposed to be working right now".
 */
export function checkClient(
  client: DbClientForCalendarCheck,
  refresh: RefreshOutcome,
  probe: CalendarProbeOutcome = { kind: 'skipped' },
): CalendarOAuthFinding[] {
  const findings: CalendarOAuthFinding[] = []
  const slug = client.slug

  // Defensive: harness should only run against booking_enabled=true + connected.
  // If somehow a row slips through, treat as no-op (not a finding).
  if (!client.booking_enabled) return findings
  if (client.calendar_auth_status !== 'connected') return findings
  // No refresh token to test — surface as P0 since booking will definitely fail
  // (see src/app/api/calendar/[slug]/book/route.ts line 53 — it 404s without one).
  if (!client.google_refresh_token) {
    findings.push({
      check_name: 'oauth_refresh_token_missing',
      severity: 'P0',
      client_slug: slug,
      summary: `booking_enabled=true and calendar_auth_status=connected but google_refresh_token is NULL — booking will 404`,
      details: {
        calendar_auth_status: client.calendar_auth_status,
        google_calendar_id: client.google_calendar_id,
      },
    })
    return findings
  }

  switch (refresh.kind) {
    case 'invalid_grant':
      // Refresh token revoked / expired / user removed our grant. Booking is
      // broken until the user re-authorizes via Settings → Calendar.
      findings.push({
        check_name: 'oauth_token_revoked',
        severity: 'P0',
        client_slug: slug,
        summary: `Google refresh token invalid (invalid_grant) — booking is broken until re-auth`,
        details: {
          google_error: 'invalid_grant',
          google_description: refresh.description ?? null,
          calendar_auth_status: client.calendar_auth_status,
        },
      })
      break

    case 'invalid_client':
      // Our OAuth client credentials are the problem. The aggregator (below)
      // escalates this to an account-level finding when many clients hit it
      // simultaneously — but we still emit per-client so /admin/harness shows
      // exactly which clients are blocked.
      findings.push({
        check_name: 'oauth_client_credentials_invalid',
        severity: 'P0',
        client_slug: slug,
        summary: `Google rejected our OAuth client credentials (invalid_client / 401) — our app config is broken, not the user's grant`,
        details: {
          google_error: 'invalid_client',
          google_description: refresh.description ?? null,
        },
      })
      break

    case 'transient':
      // Google 5xx. Script layer is expected to retry once; if it still
      // returns transient we emit P2 so the operator can keep an eye on it
      // but it doesn't wake anyone up.
      findings.push({
        check_name: 'oauth_refresh_transient_error',
        severity: 'P2',
        client_slug: slug,
        summary: `Google token endpoint returned ${refresh.status} (transient) — retry once, then warn`,
        details: {
          google_status: refresh.status,
          google_description: refresh.description ?? null,
        },
      })
      break

    case 'unknown_error':
      // Unexpected shape — treat as P1 so it surfaces on the dashboard but
      // doesn't trigger Telegram noise. Investigate via details payload.
      findings.push({
        check_name: 'oauth_refresh_unknown_error',
        severity: 'P1',
        client_slug: slug,
        summary: `Google token endpoint returned unexpected status ${refresh.status}`,
        details: {
          google_status: refresh.status,
          google_description: refresh.description ?? null,
        },
      })
      break

    case 'ok':
      // Token refreshed fine. Check optional secondary signals.
      if (refresh.expires_in < NEAR_EXPIRY_THRESHOLD_SECONDS) {
        findings.push({
          check_name: 'oauth_token_near_expiry',
          severity: 'P1',
          client_slug: slug,
          summary: `Refresh succeeded but access_token expires_in=${refresh.expires_in}s (< ${NEAR_EXPIRY_THRESHOLD_SECONDS}s) — unusual, normally 3599s`,
          details: {
            expires_in: refresh.expires_in,
            threshold_seconds: NEAR_EXPIRY_THRESHOLD_SECONDS,
          },
        })
      }
      // Calendar probe is only meaningful when refresh succeeded.
      if (probe.kind === 'not_found') {
        findings.push({
          check_name: 'calendar_deleted',
          severity: 'P0',
          client_slug: slug,
          summary: `Refresh worked but calendar ${client.google_calendar_id ?? 'primary'} returned 404 — calendar was deleted in Google`,
          details: {
            calendar_id: client.google_calendar_id ?? 'primary',
          },
        })
      } else if (probe.kind === 'error') {
        // Probe failure with a live token = surfaceable signal but not P0.
        // Could be Google rate-limiting calendar.v3.
        findings.push({
          check_name: 'calendar_probe_failed',
          severity: 'P2',
          client_slug: slug,
          summary: `Calendar metadata probe failed (HTTP ${probe.status}) — refresh OK so booking may still work`,
          details: {
            calendar_id: client.google_calendar_id ?? 'primary',
            probe_status: probe.status,
            probe_message: probe.message ?? null,
          },
        })
      }
      break
  }

  return findings
}

// ─── Account-level escalation ──────────────────────────────────────────

/**
 * If multiple clients fail with invalid_client simultaneously, escalate to a
 * single account-level finding. The per-client findings stay in place (the
 * dashboard wants to know which clients are blocked), but we also emit one
 * fleet-wide row that captures "the OAuth app itself is broken" — the
 * actionable root cause.
 *
 * Why a fraction not an absolute count: a single concierge client misconfigured
 * shouldn't trip the account-level flag; but in a fleet of N clients, 50%+
 * hitting invalid_client at once is unambiguously our problem, not theirs.
 *
 * `checkedCount` is the size of the working set (clients with
 * booking_enabled=true + calendar_auth_status=connected) — denominator for the
 * fraction. We require at least 2 invalid_client hits regardless of fraction;
 * a single 401 is more likely an upstream blip than a credentials problem.
 */
export function maybeEscalateInvalidClient(
  findings: CalendarOAuthFinding[],
  checkedCount: number,
  fraction: number = INVALID_CLIENT_ESCALATION_FRACTION,
): CalendarOAuthFinding | null {
  const hits = findings.filter(f => f.check_name === 'oauth_client_credentials_invalid')
  if (hits.length < 2) return null
  if (checkedCount === 0) return null
  if (hits.length / checkedCount < fraction) return null
  return {
    check_name: 'oauth_client_credentials_invalid_fleetwide',
    severity: 'P0',
    client_slug: null,
    summary: `${hits.length}/${checkedCount} connected clients hit invalid_client (401) on Google token refresh — our OAuth app credentials are likely the problem, not individual user grants`,
    details: {
      affected_clients: hits.length,
      checked_clients: checkedCount,
      fraction_threshold: fraction,
      sample_slugs: hits.slice(0, 8).map(f => f.client_slug).filter((x): x is string => !!x),
    },
  }
}

// ─── Aggregate exit code ───────────────────────────────────────────────

/**
 * Aggregate severity for exit-code logic. Same convention as stripe-drift /
 * twilio-ownership so the GH workflow can distinguish wake-up severity from
 * morning-triage severity without parsing logs.
 *
 *   P0 → exit 1   (booking broken for at least one client)
 *   P1 (no P0) → exit 2
 *   P2 only / none → exit 0   (transient warnings don't fail CI)
 */
export function exitCodeForFindings(findings: CalendarOAuthFinding[]): 0 | 1 | 2 {
  if (findings.some(f => f.severity === 'P0')) return 1
  if (findings.some(f => f.severity === 'P1')) return 2
  return 0
}
