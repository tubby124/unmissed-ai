/** Boundary check for the hasan-sharif calling window (09:00-19:00 America/Regina). */
import { withinCallingWindow, resolveCallingWindowConfig } from '../src/lib/outbound-window'

const client = {
  timezone: 'America/Regina',
  outbound_time_window_start: '09:00:00',
  outbound_time_window_end: '19:00:00',
  outbound_allowed_start: '09:00:00',
  outbound_allowed_end: '19:00:00',
  outbound_allowed_days: [1, 2, 3, 4, 5, 6, 7],
}
const cfg = resolveCallingWindowConfig(client as never)
const cases: Array<[string, Date]> = [
  ['NOW (should be ~10:xx PM local — BLOCKED)', new Date()],
  ['10:00 PM local', new Date('2026-08-19T22:00:00-06:00')],
  ['07:00 PM local (19:00 = inclusive end — ALLOWED)', new Date('2026-08-19T19:00:00-06:00')],
  ['07:01 PM local (19:01 — BLOCKED)', new Date('2026-08-19T19:01:00-06:00')],
  ['09:00 AM local (09:00 = inclusive start — ALLOWED)', new Date('2026-08-19T09:00:00-06:00')],
  ['08:59 AM local (BLOCKED)', new Date('2026-08-19T08:59:00-06:00')],
]
let allGood = true
for (const [label, d] of cases) {
  const allowed = withinCallingWindow('America/Regina', d, cfg)
  console.log(label.padEnd(52), '→', allowed ? 'ALLOWED' : 'BLOCKED')
}
