import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  capabilitiesFromRuntimeTools,
  resolveRuntimeToolTruth,
} from '../runtime-tool-truth.js'

describe('capabilitiesFromRuntimeTools', () => {
  test('maps deployed tool names to dashboard capability flags', () => {
    const out = capabilitiesFromRuntimeTools([
      'hangUp',
      'sendTextMessage',
      'transitionToBookingStage',
      'transferCall',
      'queryKnowledge',
    ])

    assert.deepEqual(out, {
      hasKnowledge: true,
      hasBooking: true,
      hasSms: true,
      hasTransfer: true,
    })
  })

  test('recognizes stage booking tools as booking capability too', () => {
    assert.equal(capabilitiesFromRuntimeTools(['checkCalendarAvailability']).hasBooking, true)
    assert.equal(capabilitiesFromRuntimeTools(['bookAppointment']).hasBooking, true)
  })
})

describe('resolveRuntimeToolTruth', () => {
  const db = {
    hasKnowledge: true,
    hasBooking: true,
    hasSms: true,
    hasTransfer: true,
  }

  test('falls back to DB/home API truth when runtime state is unavailable', () => {
    const out = resolveRuntimeToolTruth(db, null)
    assert.equal(out.usingRuntime, false)
    assert.deepEqual(out.effective, db)
    assert.deepEqual(out.notLive, {
      hasKnowledge: false,
      hasBooking: false,
      hasSms: false,
      hasTransfer: false,
    })
  })

  test('falls back to DB/home API truth when the runtime endpoint is feature-flagged off', () => {
    const out = resolveRuntimeToolTruth(db, {
      syncStatus: 'unknown',
      deployed: { tools: [] },
    })
    assert.equal(out.usingRuntime, false)
    assert.deepEqual(out.effective, db)
  })

  test('prefers deployed tool truth when runtime state is available', () => {
    const out = resolveRuntimeToolTruth(db, {
      syncStatus: 'success',
      deployed: { tools: ['hangUp', 'sendTextMessage'] },
    })

    assert.equal(out.usingRuntime, true)
    assert.deepEqual(out.effective, {
      hasKnowledge: false,
      hasBooking: false,
      hasSms: true,
      hasTransfer: false,
    })
    assert.deepEqual(out.notLive, {
      hasKnowledge: true,
      hasBooking: true,
      hasSms: false,
      hasTransfer: true,
    })
  })
})
