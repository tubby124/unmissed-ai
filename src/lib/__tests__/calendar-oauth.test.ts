/**
 * calendar-oauth.test.ts — unit tests for src/lib/calendar-oauth.ts.
 *
 * Mocks Google's token endpoint with synthetic (status, body) pairs. No live
 * OAuth client, no SDK, no network. Run:
 *   npx tsx --test src/lib/__tests__/calendar-oauth.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyRefreshResponse,
  checkClient,
  maybeEscalateInvalidClient,
  exitCodeForFindings,
  type DbClientForCalendarCheck,
  type RefreshOutcome,
  type CalendarOAuthFinding,
  type CalendarProbeOutcome,
} from '../calendar-oauth.js'

function dbClient(overrides: Partial<DbClientForCalendarCheck> = {}): DbClientForCalendarCheck {
  return {
    id: 'cl_test',
    slug: 'acme',
    booking_enabled: true,
    calendar_auth_status: 'connected',
    google_refresh_token: 'rt_AAAAAAAAAAAAAAAA',
    google_calendar_id: 'primary',
    ...overrides,
  }
}

function findingNames(list: CalendarOAuthFinding[]): string[] {
  return list.map(f => f.check_name)
}

// ─── classifyRefreshResponse ─────────────────────────────────────────────

describe('classifyRefreshResponse', () => {
  test('200 with access_token + expires_in → ok', () => {
    const out = classifyRefreshResponse(200, { access_token: 'ya29.testlongtoken12345678', expires_in: 3599 })
    assert.equal(out.kind, 'ok')
    if (out.kind === 'ok') {
      // Only the last 8 chars retained — never the full token.
      assert.equal(out.access_token_tail, '12345678')
      assert.equal(out.expires_in, 3599)
    }
  })

  test('200 with malformed body → unknown_error', () => {
    const out = classifyRefreshResponse(200, { error: 'weird' })
    assert.equal(out.kind, 'unknown_error')
    if (out.kind === 'unknown_error') {
      assert.equal(out.status, 200)
      assert.equal(out.description, 'malformed_success_body')
    }
  })

  test('400 with error=invalid_grant → invalid_grant (token revoked)', () => {
    const out = classifyRefreshResponse(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' })
    assert.equal(out.kind, 'invalid_grant')
    if (out.kind === 'invalid_grant') {
      assert.match(out.description ?? '', /revoked/)
    }
  })

  test('400 with error=invalid_client → invalid_client (our app credentials bad)', () => {
    const out = classifyRefreshResponse(400, { error: 'invalid_client', error_description: 'The OAuth client was not found.' })
    assert.equal(out.kind, 'invalid_client')
  })

  test('400 with other error → unknown_error', () => {
    const out = classifyRefreshResponse(400, { error: 'unauthorized_client' })
    assert.equal(out.kind, 'unknown_error')
    if (out.kind === 'unknown_error') {
      assert.equal(out.description, 'unauthorized_client')
    }
  })

  test('401 → invalid_client (Google sometimes uses 401 for bad client creds)', () => {
    const out = classifyRefreshResponse(401, { error: 'invalid_client' })
    assert.equal(out.kind, 'invalid_client')
  })

  for (const s of [500, 502, 503, 504]) {
    test(`${s} → transient`, () => {
      const out = classifyRefreshResponse(s, null)
      assert.equal(out.kind, 'transient')
      if (out.kind === 'transient') assert.equal(out.status, s)
    })
  }

  test('403 → unknown_error (not transient, not invalid_grant)', () => {
    const out = classifyRefreshResponse(403, { error: 'access_denied' })
    assert.equal(out.kind, 'unknown_error')
  })

  test('null body on 400 → unknown_error', () => {
    const out = classifyRefreshResponse(400, null)
    assert.equal(out.kind, 'unknown_error')
  })
})

// ─── checkClient — invalid_grant (P0) ────────────────────────────────────

describe('checkClient — oauth_token_revoked (P0)', () => {
  test('fires on invalid_grant', () => {
    const out = checkClient(dbClient(), { kind: 'invalid_grant', description: 'revoked' })
    const f = out.find(x => x.check_name === 'oauth_token_revoked')
    assert.ok(f)
    assert.equal(f!.severity, 'P0')
    assert.equal(f!.client_slug, 'acme')
    assert.equal(f!.details.google_error, 'invalid_grant')
    // Never log the token itself
    assert.ok(!JSON.stringify(f).includes('rt_AAAA'))
  })

  test('does NOT fire on transient errors', () => {
    const out = checkClient(dbClient(), { kind: 'transient', status: 503 })
    assert.equal(findingNames(out).includes('oauth_token_revoked'), false)
  })
})

// ─── checkClient — invalid_client (P0) ───────────────────────────────────

describe('checkClient — oauth_client_credentials_invalid (P0)', () => {
  test('fires on invalid_client', () => {
    const out = checkClient(dbClient(), { kind: 'invalid_client', description: 'bad client_id' })
    const f = out.find(x => x.check_name === 'oauth_client_credentials_invalid')
    assert.ok(f)
    assert.equal(f!.severity, 'P0')
  })
})

// ─── checkClient — transient (P2) ────────────────────────────────────────

describe('checkClient — oauth_refresh_transient_error (P2)', () => {
  test('fires on transient kind', () => {
    const out = checkClient(dbClient(), { kind: 'transient', status: 502 })
    const f = out.find(x => x.check_name === 'oauth_refresh_transient_error')
    assert.ok(f)
    assert.equal(f!.severity, 'P2')
    assert.equal(f!.details.google_status, 502)
  })
})

// ─── checkClient — unknown_error (P1) ────────────────────────────────────

describe('checkClient — oauth_refresh_unknown_error (P1)', () => {
  test('fires on unknown_error kind', () => {
    const out = checkClient(dbClient(), { kind: 'unknown_error', status: 418, description: 'teapot' })
    const f = out.find(x => x.check_name === 'oauth_refresh_unknown_error')
    assert.ok(f)
    assert.equal(f!.severity, 'P1')
  })
})

// ─── checkClient — refresh OK → near-expiry / calendar probe ─────────────

describe('checkClient — refresh ok, calendar probe interplay', () => {
  const okFresh: RefreshOutcome = { kind: 'ok', access_token_tail: 'abcd1234', expires_in: 3599 }

  test('ok + normal expiry + no probe → no findings', () => {
    const out = checkClient(dbClient(), okFresh)
    assert.equal(out.length, 0)
  })

  test('ok + low expires_in → oauth_token_near_expiry (P1)', () => {
    const out = checkClient(dbClient(), { kind: 'ok', access_token_tail: 'abcd', expires_in: 120 })
    const f = out.find(x => x.check_name === 'oauth_token_near_expiry')
    assert.ok(f)
    assert.equal(f!.severity, 'P1')
    assert.equal(f!.details.expires_in, 120)
  })

  test('ok + probe=not_found → calendar_deleted (P0)', () => {
    const out = checkClient(dbClient(), okFresh, { kind: 'not_found' })
    const f = out.find(x => x.check_name === 'calendar_deleted')
    assert.ok(f)
    assert.equal(f!.severity, 'P0')
  })

  test('ok + probe=error → calendar_probe_failed (P2)', () => {
    const out = checkClient(dbClient(), okFresh, { kind: 'error', status: 429, message: 'rate limited' })
    const f = out.find(x => x.check_name === 'calendar_probe_failed')
    assert.ok(f)
    assert.equal(f!.severity, 'P2')
  })

  test('ok + probe=ok → no findings', () => {
    const out = checkClient(dbClient(), okFresh, { kind: 'ok' })
    assert.equal(out.length, 0)
  })

  test('ok + probe=skipped → no findings', () => {
    const out = checkClient(dbClient(), okFresh, { kind: 'skipped' })
    assert.equal(out.length, 0)
  })

  test('invalid_grant + any probe → calendar_deleted does NOT fire', () => {
    // Probe only meaningful after successful refresh; we never call it on a
    // failed refresh, and the rule layer must not emit calendar_deleted in
    // that combination either.
    const out = checkClient(dbClient(), { kind: 'invalid_grant' }, { kind: 'not_found' })
    assert.equal(findingNames(out).includes('calendar_deleted'), false)
  })
})

// ─── checkClient — defensive guards ──────────────────────────────────────

describe('checkClient — defensive guards', () => {
  test('booking_enabled=false → no findings (row should not be in working set)', () => {
    const out = checkClient(dbClient({ booking_enabled: false }), { kind: 'invalid_grant' })
    assert.equal(out.length, 0)
  })

  test('calendar_auth_status!=connected → no findings', () => {
    const out = checkClient(dbClient({ calendar_auth_status: 'expired' }), { kind: 'invalid_grant' })
    assert.equal(out.length, 0)
  })

  test('missing refresh token → oauth_refresh_token_missing (P0)', () => {
    const out = checkClient(dbClient({ google_refresh_token: null }), { kind: 'transient', status: 503 })
    const f = out.find(x => x.check_name === 'oauth_refresh_token_missing')
    assert.ok(f)
    assert.equal(f!.severity, 'P0')
    // Should not also emit a refresh-error finding — early return.
    assert.equal(findingNames(out).includes('oauth_refresh_transient_error'), false)
  })
})

// ─── maybeEscalateInvalidClient ──────────────────────────────────────────

describe('maybeEscalateInvalidClient', () => {
  function invalidClientFinding(slug: string): CalendarOAuthFinding {
    return {
      check_name: 'oauth_client_credentials_invalid',
      severity: 'P0',
      client_slug: slug,
      summary: 'x',
      details: {},
    }
  }

  test('returns null when no invalid_client findings', () => {
    assert.equal(maybeEscalateInvalidClient([], 5), null)
  })

  test('returns null on a single invalid_client hit (likely upstream blip)', () => {
    const out = maybeEscalateInvalidClient([invalidClientFinding('a')], 5)
    assert.equal(out, null)
  })

  test('returns null when fraction below threshold', () => {
    // 2/10 = 0.2 < 0.5 default
    const findings = [invalidClientFinding('a'), invalidClientFinding('b')]
    assert.equal(maybeEscalateInvalidClient(findings, 10), null)
  })

  test('escalates when >=50% of working set hits invalid_client', () => {
    // 3/5 = 0.6
    const findings = [
      invalidClientFinding('a'),
      invalidClientFinding('b'),
      invalidClientFinding('c'),
    ]
    const out = maybeEscalateInvalidClient(findings, 5)
    assert.ok(out)
    assert.equal(out!.check_name, 'oauth_client_credentials_invalid_fleetwide')
    assert.equal(out!.client_slug, null) // fleet-wide
    assert.equal(out!.severity, 'P0')
    assert.deepEqual(out!.details.sample_slugs, ['a', 'b', 'c'])
  })

  test('honors custom fraction', () => {
    const findings = [invalidClientFinding('a'), invalidClientFinding('b')]
    // 2/10 = 0.2 ≥ 0.2 custom → escalate
    const out = maybeEscalateInvalidClient(findings, 10, 0.2)
    assert.ok(out)
  })

  test('returns null when checkedCount=0', () => {
    const findings = [invalidClientFinding('a'), invalidClientFinding('b')]
    assert.equal(maybeEscalateInvalidClient(findings, 0), null)
  })
})

// ─── exitCodeForFindings ─────────────────────────────────────────────────

describe('exitCodeForFindings', () => {
  test('empty → 0', () => {
    assert.equal(exitCodeForFindings([]), 0)
  })

  test('only P2 → 0 (transient warnings do not fail CI)', () => {
    const out: CalendarOAuthFinding[] = [
      { check_name: 'x', severity: 'P2', client_slug: 'a', summary: 's', details: {} },
    ]
    assert.equal(exitCodeForFindings(out), 0)
  })

  test('any P1 (no P0) → 2', () => {
    const out: CalendarOAuthFinding[] = [
      { check_name: 'x', severity: 'P1', client_slug: 'a', summary: 's', details: {} },
    ]
    assert.equal(exitCodeForFindings(out), 2)
  })

  test('any P0 → 1', () => {
    const out: CalendarOAuthFinding[] = [
      { check_name: 'x', severity: 'P0', client_slug: 'a', summary: 's', details: {} },
      { check_name: 'y', severity: 'P1', client_slug: 'b', summary: 's', details: {} },
    ]
    assert.equal(exitCodeForFindings(out), 1)
  })
})

// ─── secret-leakage smoke check ──────────────────────────────────────────

describe('secret-leakage smoke check', () => {
  test('no finding object stringifies to include the refresh token', () => {
    const c = dbClient({ google_refresh_token: 'rt_SECRET_VALUE_DO_NOT_LEAK_zzzzzzzzzz' })
    const outcomes: RefreshOutcome[] = [
      { kind: 'invalid_grant', description: 'revoked' },
      { kind: 'invalid_client' },
      { kind: 'transient', status: 503 },
      { kind: 'unknown_error', status: 418 },
      { kind: 'ok', access_token_tail: 'abcd1234', expires_in: 3599 },
    ]
    for (const o of outcomes) {
      const findings = checkClient(c, o, { kind: 'not_found' })
      for (const f of findings) {
        const blob = JSON.stringify(f)
        assert.equal(blob.includes('rt_SECRET_VALUE'), false, `finding leaked refresh token: ${blob}`)
        assert.equal(blob.includes('SECRET_VALUE_DO_NOT_LEAK'), false)
      }
    }
  })

  test('classifyRefreshResponse never returns the full access_token', () => {
    const fullToken = 'ya29.fullaccess_token_redacted_DO_NOT_LEAK_xxxxxxxx'
    const out = classifyRefreshResponse(200, { access_token: fullToken, expires_in: 3599 })
    const blob = JSON.stringify(out)
    assert.equal(blob.includes(fullToken), false)
    assert.equal(blob.includes('redacted_DO_NOT_LEAK'), false)
    if (out.kind === 'ok') {
      assert.equal(out.access_token_tail.length, 8)
    }
  })
})
