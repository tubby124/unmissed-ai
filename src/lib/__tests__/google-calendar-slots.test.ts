// google-calendar's toUtc() offset trick is only correct when the process runs
// in UTC (true on Railway). Pin TZ before any Date work so these tests behave
// like production regardless of the dev machine's timezone.
process.env.TZ = 'UTC'

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { listSlots } from '../google-calendar.js'

// Regression: the slot grid is anchored at workdayStart and stepped by
// duration+buffer, so a caller's exact requested time (e.g. 14:00 on a
// 9:00-anchored 45-min step grid) never existed as a candidate even when the
// calendar was FREE — the agent counter-offered 1:30/2:30 against an open 2:00.
// listSlots must now snap a free requested time in as a real slot, first.

const TZ = 'America/Regina' // no DST — stable offsets for assertions
const DATE = '2026-06-15'

const realFetch = globalThis.fetch

function stubEvents(items: Array<{ start: string; end: string }>) {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        items: items.map(ev => ({
          start: { dateTime: ev.start },
          end: { dateTime: ev.end },
        })),
      }),
      { status: 200 },
    )) as typeof fetch
}

function localHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit',
  })
}

describe('listSlots preferred-time grid snap', () => {
  beforeEach(() => stubEvents([]))
  afterEach(() => { globalThis.fetch = realFetch })

  it('off-grid requested time that is FREE becomes the first slot (the 2pm bug)', async () => {
    // duration 30 + buffer 15 → grid 9:00, 9:45, 10:30 ... 13:30, 14:15 — no 14:00
    const slots = await listSlots('tok', 'primary', DATE, TZ, 30, 15, '09:00', '18:00', 3, '14:00')
    assert.equal(localHHMM(slots[0].start), '14:00')
    assert.match(slots[0].displayTime, /2:00 PM/)
  })

  it('requested time that is BUSY is not snapped in — closest real slots win', async () => {
    stubEvents([{ start: `${DATE}T14:00:00-06:00`, end: `${DATE}T14:30:00-06:00` }])
    const slots = await listSlots('tok', 'primary', DATE, TZ, 30, 15, '09:00', '18:00', 3, '14:00')
    assert.ok(slots.length > 0)
    for (const s of slots) assert.notEqual(localHHMM(s.start), '14:00')
  })

  it('on-grid requested time is not duplicated', async () => {
    // duration 60 + buffer 0 → grid contains 14:00 exactly
    const slots = await listSlots('tok', 'primary', DATE, TZ, 60, 0, '09:00', '18:00', 3, '14:00')
    const at14 = slots.filter(s => localHHMM(s.start) === '14:00')
    assert.equal(at14.length, 1)
    assert.equal(localHHMM(slots[0].start), '14:00')
  })

  it('requested time outside the workday is not snapped in', async () => {
    const slots = await listSlots('tok', 'primary', DATE, TZ, 30, 15, '09:00', '18:00', 3, '20:00')
    for (const s of slots) assert.notEqual(localHHMM(s.start), '20:00')
  })

  it('no preferred time → plain chronological grid, capped at maxSlots', async () => {
    const slots = await listSlots('tok', 'primary', DATE, TZ, 60, 0, '09:00', '18:00', 3)
    assert.equal(slots.length, 3)
    assert.equal(localHHMM(slots[0].start), '09:00')
    assert.equal(localHHMM(slots[1].start), '10:00')
  })
})
