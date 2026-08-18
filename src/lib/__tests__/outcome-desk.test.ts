import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LOFTY_WRITEBACK_MARKER_PREFIX,
  LOFTY_WRITEBACK_FAILURE_PREFIX,
  resolveLoftyWritebackState,
} from '../lofty-writeback.js'
import { MANUAL_OUTCOMES, MANUAL_OUTCOME_LABELS, SUPPRESSING_OUTCOMES, buildLoftyRecordUrl } from '../outcome-desk.js'

const outcomesRoute = readFileSync(new URL('../../app/api/dashboard/leads/outcomes/route.ts', import.meta.url), 'utf8')
const outcomeRoute = readFileSync(new URL('../../app/api/dashboard/leads/outcome/route.ts', import.meta.url), 'utf8')
const writebackRetryRoute = readFileSync(new URL('../../app/api/dashboard/leads/writeback-retry/route.ts', import.meta.url), 'utf8')

describe('resolveLoftyWritebackState', () => {
  it('returns n/a when there is no numeric Lofty lead id', () => {
    assert.equal(resolveLoftyWritebackState({ notes: null, loftyLeadId: null }), 'n/a')
    assert.equal(resolveLoftyWritebackState({ notes: 'x', loftyLeadId: '550e8400-e29b-41d4-a716-446655440000' }), 'n/a')
    assert.equal(resolveLoftyWritebackState({ notes: 'x', loftyLeadId: '0' }), 'n/a')
  })

  it('returns pending for a numeric Lofty lead with no markers yet', () => {
    assert.equal(resolveLoftyWritebackState({ notes: null, loftyLeadId: '123456789' }), 'pending')
    assert.equal(resolveLoftyWritebackState({ notes: 'just a normal note', loftyLeadId: '123456789' }), 'pending')
  })

  it('returns synced when the latest marker is a success marker', () => {
    const notes = `${LOFTY_WRITEBACK_MARKER_PREFIX} call-1\nDisposition: answered`
    assert.equal(resolveLoftyWritebackState({ notes, loftyLeadId: '123456789' }), 'synced')
  })

  it('returns failed when the latest marker is a failure marker', () => {
    const notes = `${LOFTY_WRITEBACK_FAILURE_PREFIX} 2026-08-18 call_id=call-1`
    assert.equal(resolveLoftyWritebackState({ notes, loftyLeadId: '123456789' }), 'failed')
  })

  it('resolves by last-occurrence so a successful retry clears a prior failure', () => {
    const notes = [
      `${LOFTY_WRITEBACK_FAILURE_PREFIX} 2026-08-18 call_id=call-1`,
      `${LOFTY_WRITEBACK_MARKER_PREFIX} call-1`,
    ].join('\n')
    assert.equal(resolveLoftyWritebackState({ notes, loftyLeadId: '123456789' }), 'synced')
  })

  it('resolves by last-occurrence so a later failure overrides an earlier success', () => {
    const notes = [
      `${LOFTY_WRITEBACK_MARKER_PREFIX} call-1`,
      `${LOFTY_WRITEBACK_FAILURE_PREFIX} 2026-08-18 call_id=call-2`,
    ].join('\n')
    assert.equal(resolveLoftyWritebackState({ notes, loftyLeadId: '123456789' }), 'failed')
  })
})

describe('outcome-desk helpers', () => {
  it('exposes the exact Lofty disposition vocabulary with no drift', () => {
    assert.deepEqual([...MANUAL_OUTCOMES].sort(), [
      'active_now', 'answered', 'do_not_call', 'future_timeline',
      'no_answer', 'not_looking', 'voicemail', 'wrong_number',
    ].sort())
    assert.equal(new Set(MANUAL_OUTCOMES).size, MANUAL_OUTCOMES.length)
    for (const outcome of MANUAL_OUTCOMES) {
      assert.equal(typeof MANUAL_OUTCOME_LABELS[outcome], 'string')
    }
  })

  it('only treats do_not_call and wrong_number as suppressing outcomes', () => {
    assert.deepEqual([...SUPPRESSING_OUTCOMES].sort(), ['do_not_call', 'wrong_number'])
  })

  it('builds a Lofty record link with a configurable base', () => {
    assert.equal(buildLoftyRecordUrl(null), null)
    assert.equal(buildLoftyRecordUrl(''), null)
    assert.equal(buildLoftyRecordUrl('123456789'), 'https://app.lofty.com/leads/123456789')

    const original = process.env.LOFTY_APP_BASE_URL
    process.env.LOFTY_APP_BASE_URL = 'https://app.lofty.com/'
    assert.equal(buildLoftyRecordUrl('987'), 'https://app.lofty.com/leads/987')
    if (original === undefined) delete process.env.LOFTY_APP_BASE_URL
    else process.env.LOFTY_APP_BASE_URL = original
  })
})

describe('call outcome desk route contracts', () => {
  it('never uses .single() in any new route (client_users rule)', () => {
    for (const route of [outcomesRoute, outcomeRoute, writebackRetryRoute]) {
      assert.doesNotMatch(route, /\.single\(\)/)
    }
  })

  it('uses .limit(1).maybeSingle() for client_users lookups', () => {
    for (const route of [outcomesRoute, outcomeRoute, writebackRetryRoute]) {
      assert.match(route, /from\('client_users'\)[\s\S]*?\.limit\(1\)\.maybeSingle\(\)/)
    }
  })

  it('outcomes GET returns can_listen and a writeback_state per lead', () => {
    assert.match(outcomesRoute, /can_listen/)
    assert.match(outcomesRoute, /resolveLoftyWritebackState/)
    assert.match(outcomesRoute, /recording_url: log\?\.ultravox_call_id \? `\/api\/dashboard\/calls\/\$\{log\.ultravox_call_id\}\/recording`/)
  })

  it('outcome POST exposes explicit one-lead controls, not a bulk dial', () => {
    for (const action of ['approve_next', 'hold', 'manual_outcome', 'dnc']) {
      assert.match(outcomeRoute, new RegExp(`'${action}'`))
    }
    assert.match(outcomeRoute, /scheduled_callback_at = new Date\(\)\.toISOString\(\)/)
    assert.match(outcomeRoute, /cu\.role === 'viewer'/)
    // One lead, one explicit approval — never a bulk id-list update.
    assert.match(outcomeRoute, /\.eq\('id', id\)/)
    assert.doesNotMatch(outcomeRoute, /\.in\('id'/)
  })

  it('writeback-retry reconstructs classification and re-runs the idempotent writeback', () => {
    assert.match(writebackRetryRoute, /writeCompletedCallToLofty/)
    assert.match(writebackRetryRoute, /isNumericSafeLoftyLeadId/)
    assert.match(writebackRetryRoute, /isHasanSharifRealEstateClient/)
    assert.match(writebackRetryRoute, /REALTOR_LOFTY_REVIVAL_MODE/)
    assert.match(writebackRetryRoute, /Already synced to Lofty/)
  })
})
