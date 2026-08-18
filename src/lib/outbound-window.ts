/**
 * outbound-window.ts — timezone-aware outbound calling-window logic.
 *
 * Single source of truth for "is it legal/allowed to dial this client's lead
 * right now?" across every outbound entry point:
 *   - /api/dashboard/leads/dial-out (manual dial)
 *   - /api/cron/scheduled-callbacks    (automated dial)
 *   - /api/external/lead-call          (speed-to-lead scheduling)
 *
 * All times are interpreted in the CLIENT's timezone (e.g. America/Edmonton
 * for Hasan/Calgary, America/Regina for Saskatchewan). DST is handled by
 * `Intl.DateTimeFormat` with an explicit `timeZone`, which is DST-safe —
 * the same local wall-clock time maps to a different UTC instant across the
 * spring/fall transitions, and this module never does manual offset math.
 *
 * Default windows (when a client has no explicit window configured) match the
 * pre-existing CRTC/ADAD-safe behavior that the external lead-call route
 * hardcoded:
 *   - weekdays 09:00–20:30 local
 *   - weekends 10:00–17:30 local
 *
 * Window config is resolved from the existing client columns by
 * `resolveCallingWindowConfig()`, which reconciles the two column families
 * that historically disagreed:
 *   - `clients.outbound_time_window_start/end` — what the Settings UI
 *     (OutboundSchedulingCard) actually writes.
 *   - `clients.outbound_allowed_start/end` (+ `outbound_allowed_days`) — the
 *     newer columns the dial-out route used to read.
 * No new schema is introduced here.
 */

export interface CallingWindow {
  /** Local start time, 'HH:MM' (client timezone). */
  start: string
  /** Local end time, 'HH:MM' (client timezone). */
  end: string
}

export interface CallingWindowConfig {
  /** Explicit single window applied to every allowed day. `null` → use defaults. */
  start?: string | null
  end?: string | null
  /** Allowed ISO weekdays (1=Mon … 7=Sun). `null`/empty → every day. */
  days?: number[] | null
}

export const DEFAULT_TIMEZONE = 'America/Edmonton'

export const DEFAULT_WEEKDAY_WINDOW: CallingWindow = { start: '09:00', end: '20:30' }
export const DEFAULT_WEEKEND_WINDOW: CallingWindow = { start: '10:00', end: '17:30' }

const WEEKDAY_BY_NAME: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
}

/** Parse 'HH:MM' (also tolerates Postgres `time` 'HH:MM:SS') → minutes since midnight, or null. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export interface LocalClock {
  /** Minutes since local midnight. */
  minutes: number
  /** ISO weekday 1=Mon … 7=Sun. */
  weekday: number
  isWeekend: boolean
}

/** DST-safe local wall-clock read for a given instant and timezone. */
export function localClock(tz: string, d: Date): LocalClock {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  const hour = Number(parts.hour) % 24
  const minutes = hour * 60 + Number(parts.minute)
  const weekday = WEEKDAY_BY_NAME[parts.weekday] ?? 1
  return { minutes, weekday, isWeekend: weekday === 6 || weekday === 7 }
}

function dayAllowed(config: CallingWindowConfig | null | undefined, weekday: number): boolean {
  if (!config?.days || config.days.length === 0) return true
  return config.days.includes(weekday)
}

function windowForDay(config: CallingWindowConfig | null | undefined, isWeekend: boolean): CallingWindow {
  if (config?.start && config?.end) return { start: config.start, end: config.end }
  return isWeekend ? DEFAULT_WEEKEND_WINDOW : DEFAULT_WEEKDAY_WINDOW
}

/**
 * True when `d` falls inside the client's allowed calling window.
 * Bound endpoints are inclusive (09:00 and 20:30 are both allowed).
 */
export function withinCallingWindow(
  tz: string,
  d: Date,
  config?: CallingWindowConfig | null,
): boolean {
  const clock = localClock(tz, d)
  if (!dayAllowed(config, clock.weekday)) return false
  const window = windowForDay(config, clock.isWeekend)
  const start = parseHHMM(window.start)
  const end = parseHHMM(window.end)
  // A malformed/unset window is treated as "no restriction" rather than "blocked".
  if (start == null || end == null) return true
  return clock.minutes >= start && clock.minutes <= end
}

/** Next instant (15-min steps, bounded to 7 days) inside the calling window. */
export function nextCallingWindow(
  tz: string,
  from: Date,
  config?: CallingWindowConfig | null,
): Date {
  const step = 15 * 60 * 1000
  let t = from.getTime()
  for (let i = 0; i < (7 * 24 * 60) / 15; i++) {
    t += step
    const candidate = new Date(t)
    if (withinCallingWindow(tz, candidate, config)) return candidate
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000)
}

export interface ClientWindowColumns {
  outbound_time_window_start?: string | null
  outbound_time_window_end?: string | null
  outbound_allowed_start?: string | null
  outbound_allowed_end?: string | null
  outbound_allowed_days?: number[] | null
}

/**
 * Reconcile the two existing window column families into one config.
 *
 * Precedence: the Settings UI writes `outbound_time_window_start/end`, so that
 * is authoritative when present. `outbound_allowed_start/end` (the `time`-typed
 * columns the dial-out route used to read) are the fallback, so any client that
 * was configured through those columns keeps working. `outbound_allowed_days`
 * restricts which weekdays are dialable; it applies to either family.
 *
 * Returns `null` when there is nothing configured (caller falls back to the
 * default weekday/weekend windows).
 */
export function resolveCallingWindowConfig(c: ClientWindowColumns | null | undefined): CallingWindowConfig | null {
  if (!c) return null
  const start = firstNonEmpty(c.outbound_time_window_start, c.outbound_allowed_start)
  const end = firstNonEmpty(c.outbound_time_window_end, c.outbound_allowed_end)
  const days = Array.isArray(c.outbound_allowed_days) && c.outbound_allowed_days.length
    ? c.outbound_allowed_days
    : null

  const hasWindow = !!start && !!end
  if (!hasWindow && !days) return null
  return {
    start: hasWindow ? start : null,
    end: hasWindow ? end : null,
    days,
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}
