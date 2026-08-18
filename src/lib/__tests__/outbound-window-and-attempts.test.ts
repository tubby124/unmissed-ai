/**
 * outbound-window-and-attempts.test.ts — Task 8 unit tests.
 *
 * Covers:
 *   - timezone-aware calling windows (Regina weekday/weekend boundaries)
 *   - Calgary (America/Edmonton) weekday/weekend boundaries
 *   - DST-safe Calgary behavior (same local wall-clock → different UTC across DST)
 *   - 3-attempt cap
 *   - DNC / wrong-number immediate termination
 *   - 48h no-answer retry cooldown
 *
 * Run: npx tsx --test src/lib/__tests__/outbound-window-and-attempts.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  withinCallingWindow,
  nextCallingWindow,
  resolveCallingWindowConfig,
  DEFAULT_WEEKDAY_WINDOW,
  DEFAULT_WEEKEND_WINDOW,
  parseHHMM,
} from '../outbound-window.js'
import {
  shouldAttemptAutomatedCall,
  nextRetryAt,
  resolveMaxAttempts,
  withinMissedCallSmsCooldown,
  RETRY_COOLDOWN_MS,
  MISSED_CALL_SMS_COOLDOWN_MS,
} from '../outbound-attempts.js'

// ── Timezone-aware calling windows ──────────────────────────────────────────

describe('withinCallingWindow — Regina (America/Regina, CST no-DST)', () => {
  // Regina is UTC-6 year-round. Default window: weekdays 09:00–20:30,
  // weekends 10:00–17:30 local.
  it('weekday 09:00 local (15:00 UTC) is inside the window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-18T15:00:00Z')), true)
  })
  it('weekday 08:59 local (14:59 UTC) is before the window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-18T14:59:00Z')), false)
  })
  it('weekday 20:30 local (02:30 UTC next day) is inside the window (inclusive end)', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-19T02:30:00Z')), true)
  })
  it('weekday 20:31 local (02:31 UTC next day) is after the window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-19T02:31:00Z')), false)
  })
  it('weekend 10:00 local (16:00 UTC) is inside the window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T16:00:00Z')), true)
  })
  it('weekend 09:59 local (15:59 UTC) is before the weekend window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T15:59:00Z')), false)
  })
  it('weekend 17:30 local (23:30 UTC) is inside the window (inclusive end)', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T23:30:00Z')), true)
  })
  it('weekend 17:31 local (23:31 UTC) is after the window', () => {
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T23:31:00Z')), false)
  })
})

describe('withinCallingWindow — Calgary (America/Edmonton) + DST-safety', () => {
  it('winter weekday 09:00 local (16:00 UTC, MST) is inside the window', () => {
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-01-14T16:00:00Z')), true)
  })
  it('winter weekday 08:59 local (15:59 UTC, MST) is before the window', () => {
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-01-14T15:59:00Z')), false)
  })
  it('winter weekend 10:00 local (17:00 UTC, MST) is inside the window', () => {
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-01-17T17:00:00Z')), true)
  })
  it('winter weekend 09:59 local (16:59 UTC, MST) is before the window', () => {
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-01-17T16:59:00Z')), false)
  })
  it('summer weekday 09:00 local (15:00 UTC, MDT) is inside the window — DST-safe', () => {
    // Same local wall-clock as the winter 09:00 case, but a different UTC hour.
    // A UTC-based comparison would flip this to "outside" during DST.
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-07-15T15:00:00Z')), true)
  })
  it('summer weekend 17:30 local (23:30 UTC, MDT) is inside the window — DST-safe', () => {
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-07-18T23:30:00Z')), true)
  })
  it('a UTC instant that is "9am UTC" but 02:00 local Calgary is outside the window', () => {
    // 09:00 UTC = 02:00 MST in January — far outside the local window.
    assert.equal(withinCallingWindow('America/Edmonton', new Date('2026-01-14T09:00:00Z')), false)
  })
})

describe('withinCallingWindow — explicit client window config', () => {
  it('a client-configured single window applies to both weekdays and weekends', () => {
    const config = { start: '08:00', end: '18:00' }
    // Wed 08:00 Regina local
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-18T14:00:00Z'), config), true)
    // Sat 08:00 Regina local (would be outside the default weekend 10:00 window)
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T14:00:00Z'), config), true)
    // Sat 17:59 local still inside
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T23:59:00Z'), config), true)
  })
  it('outbound_allowed_days restricts which weekdays are dialable', () => {
    // Mon–Fri only
    const config = { days: [1, 2, 3, 4, 5] }
    // Wed 12:00 Regina local = 18:00 UTC → allowed
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-18T18:00:00Z'), config), true)
    // Sat 12:00 Regina local = 18:00 UTC → blocked by days
    assert.equal(withinCallingWindow('America/Regina', new Date('2026-03-21T18:00:00Z'), config), false)
  })
})

describe('resolveCallingWindowConfig — reconciling the two column families', () => {
  it('prefers outbound_time_window_* (Settings UI) over outbound_allowed_*', () => {
    const cfg = resolveCallingWindowConfig({
      outbound_time_window_start: '09:00',
      outbound_time_window_end: '17:00',
      outbound_allowed_start: '10:00:00',
      outbound_allowed_end: '16:00:00',
    })
    assert.equal(cfg?.start, '09:00')
    assert.equal(cfg?.end, '17:00')
  })
  it('falls back to outbound_allowed_* when the Settings UI window is unset', () => {
    const cfg = resolveCallingWindowConfig({
      outbound_allowed_start: '10:00:00',
      outbound_allowed_end: '16:00:00',
      outbound_allowed_days: [1, 2, 3, 4, 5],
    })
    assert.equal(cfg?.start, '10:00:00')
    assert.equal(cfg?.end, '16:00:00')
    assert.deepEqual(cfg?.days, [1, 2, 3, 4, 5])
  })
  it('returns null when nothing is configured', () => {
    assert.equal(resolveCallingWindowConfig({}), null)
    assert.equal(resolveCallingWindowConfig(null), null)
  })
})

describe('nextCallingWindow', () => {
  it('returns a future instant that is inside the window', () => {
    // 03:00 local Regina (09:00 UTC) — before the weekday window.
    const from = new Date('2026-03-18T09:00:00Z')
    const next = nextCallingWindow('America/Regina', from)
    assert.ok(next.getTime() > from.getTime())
    assert.equal(withinCallingWindow('America/Regina', next), true)
  })
})

describe('parseHHMM', () => {
  it('parses HH:MM and Postgres time HH:MM:SS', () => {
    assert.equal(parseHHMM('09:00'), 540)
    assert.equal(parseHHMM('20:30'), 1230)
    assert.equal(parseHHMM('09:00:00'), 540)
    assert.equal(parseHHMM(null), null)
    assert.equal(parseHHMM('bogus'), null)
  })
})

describe('default window constants', () => {
  it('match the pre-existing CRTC/ADAD-safe windows', () => {
    assert.deepEqual(DEFAULT_WEEKDAY_WINDOW, { start: '09:00', end: '20:30' })
    assert.deepEqual(DEFAULT_WEEKEND_WINDOW, { start: '10:00', end: '17:30' })
  })
})

// ── Campaign attempt controls ───────────────────────────────────────────────

describe('shouldAttemptAutomatedCall — 3-attempt cap', () => {
  it('allows attempts while under the cap', () => {
    assert.equal(shouldAttemptAutomatedCall({ call_count: 0, disposition: null }).allowed, true)
    assert.equal(shouldAttemptAutomatedCall({ call_count: 2, disposition: 'no-answer' }, { now: new Date('2026-03-21T00:00:00Z') }).allowed, true)
  })
  it('blocks the 3rd+ attempt by default', () => {
    const r = shouldAttemptAutomatedCall({ call_count: 3, disposition: 'no-answer' })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'attempt_cap')
  })
  it('honors a client-configured max_attempts override', () => {
    const r = shouldAttemptAutomatedCall({ call_count: 4, disposition: 'no-answer' }, { maxAttempts: 5 })
    assert.equal(r.allowed, true)
    const capped = shouldAttemptAutomatedCall({ call_count: 5, disposition: 'no-answer' }, { maxAttempts: 5 })
    assert.equal(capped.allowed, false)
    assert.equal(capped.reason, 'attempt_cap')
  })
})

describe('shouldAttemptAutomatedCall — DNC / wrong-number termination', () => {
  it('blocks dnc status immediately', () => {
    const r = shouldAttemptAutomatedCall({ status: 'dnc', call_count: 0 })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'dnc')
  })
  it('blocks wrong-number / do-not-call dispositions immediately (before the cap)', () => {
    for (const d of ['wrong_number', 'do_not_call', 'wrong-number', 'do not call']) {
      const r = shouldAttemptAutomatedCall({ call_count: 0, disposition: d })
      assert.equal(r.allowed, false, `disposition=${d}`)
      assert.equal(r.reason, 'wrong_number')
    }
  })
  it('never auto-redials an answered lead', () => {
    const r = shouldAttemptAutomatedCall({ call_count: 0, disposition: 'answered' })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'answered')
  })
})

describe('shouldAttemptAutomatedCall — 48h no-answer cooldown', () => {
  const now = new Date('2026-03-20T12:00:00Z')
  it('blocks a retry less than 48h after the last no-answer', () => {
    const lastCalled = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const r = shouldAttemptAutomatedCall({ call_count: 1, disposition: 'no-answer', last_called_at: lastCalled }, { now })
    assert.equal(r.allowed, false)
    assert.equal(r.reason, 'cooldown')
  })
  it('allows a retry at or beyond 48h', () => {
    const lastCalled = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const r = shouldAttemptAutomatedCall({ call_count: 1, disposition: 'no-answer', last_called_at: lastCalled }, { now })
    assert.equal(r.allowed, true)
  })
  it('does not apply the cooldown to a never-called lead', () => {
    const r = shouldAttemptAutomatedCall({ call_count: 0, disposition: null, last_called_at: null }, { now })
    assert.equal(r.allowed, true)
  })
})

describe('nextRetryAt — 48h no-answer retry scheduling', () => {
  it('schedules at least 48h after the no-answer', () => {
    const noAnswerAt = new Date('2026-03-18T18:00:00Z')
    const retry = nextRetryAt(noAnswerAt, 'America/Regina', null, noAnswerAt)
    assert.equal(retry.getTime() - noAnswerAt.getTime(), RETRY_COOLDOWN_MS)
  })
  it('snaps forward into the next calling window when +48h lands outside one', () => {
    // Wed 20:30 Regina local (weekday end) → +48h = Fri 20:30 local, still inside.
    // Use a no-answer on a Friday evening so +48h lands in the weekend gap.
    const noAnswerAt = new Date('2026-03-21T02:31:00Z') // Fri 20:31 Regina (just past weekday end)
    const retry = nextRetryAt(noAnswerAt, 'America/Regina', null, noAnswerAt)
    assert.ok(retry.getTime() >= noAnswerAt.getTime() + RETRY_COOLDOWN_MS)
    assert.equal(withinCallingWindow('America/Regina', retry), true)
  })
})

describe('resolveMaxAttempts', () => {
  it('defaults to 3 when unset/invalid', () => {
    assert.equal(resolveMaxAttempts(null), 3)
    assert.equal(resolveMaxAttempts(undefined), 3)
    assert.equal(resolveMaxAttempts(0), 3)
    assert.equal(resolveMaxAttempts(-1), 3)
  })
  it('returns a valid configured cap', () => {
    assert.equal(resolveMaxAttempts(5), 5)
  })
})

describe('withinMissedCallSmsCooldown — one missed-call SMS per 24h', () => {
  const now = new Date('2026-03-20T12:00:00Z')
  it('true when the last missed-call SMS was within 24h', () => {
    assert.equal(withinMissedCallSmsCooldown(new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), now), true)
  })
  it('false when the last missed-call SMS was beyond 24h', () => {
    assert.equal(withinMissedCallSmsCooldown(new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), now), false)
  })
  it('false when none was ever sent', () => {
    assert.equal(withinMissedCallSmsCooldown(null, now), false)
  })
  it('exposes the 24h constant', () => {
    assert.equal(MISSED_CALL_SMS_COOLDOWN_MS, 24 * 60 * 60 * 1000)
  })
})
