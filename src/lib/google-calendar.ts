const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

/** Exchange refresh_token for a short-lived access_token */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token refresh failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  return data.access_token as string
}

export interface TimeSlot {
  start: string  // ISO 8601 in client's local timezone
  end: string
  displayTime: string  // Human-readable: "Friday March 20 at 2:00 PM"
}

/** List available slots for a given date in the client's timezone */
export async function listSlots(
  accessToken: string,
  calendarId: string,
  dateStr: string,  // YYYY-MM-DD in client's timezone
  timezone: string,
  durationMinutes: number,
  bufferMinutes: number,
  workdayStart = '09:00',
  workdayEnd = '18:00',
  maxSlots = 3,     // Return at most this many slots — keeps agent responses concise
  preferredTime?: string,  // HH:MM (24h) — if provided, return slots closest to this time
): Promise<TimeSlot[]> {
  // Build time range for the day in the client's local timezone (not UTC)
  const dayStart = parseLocalTime(dateStr, workdayStart, timezone)
  const dayEnd   = parseLocalTime(dateStr, workdayEnd,   timezone)

  // Fetch existing events for the day
  const params = new URLSearchParams({
    timeMin: toUtc(dateStr, workdayStart, timezone),
    timeMax: toUtc(dateStr, workdayEnd, timezone),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar listEvents failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  const busyBlocks: { start: Date; end: Date }[] = (data.items || []).map((ev: { start?: { dateTime?: string }; end?: { dateTime?: string } }) => ({
    start: new Date(ev.start?.dateTime ?? ''),
    end: new Date(ev.end?.dateTime ?? ''),
  }))

  // Generate ALL candidate slots for the day (don't cap during generation)
  const allSlots: TimeSlot[] = []
  let cursor = dayStart
  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000)
    if (slotEnd > dayEnd) break

    const busy = busyBlocks.some(b => cursor < b.end && slotEnd > b.start)
    if (!busy) {
      allSlots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
        displayTime: formatLocal(cursor, timezone),
      })
    }

    cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60_000)
  }

  // If preferredTime provided, sort by proximity to that time, then take maxSlots
  if (preferredTime && /^\d{2}:\d{2}$/.test(preferredTime)) {
    const prefTarget = parseLocalTime(dateStr, preferredTime, timezone).getTime()
    allSlots.sort((a, b) => {
      const distA = Math.abs(new Date(a.start).getTime() - prefTarget)
      const distB = Math.abs(new Date(b.start).getTime() - prefTarget)
      return distA - distB
    })
  }

  return allSlots.slice(0, maxSlots)
}

/** Create a calendar event (booking) */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  {
    title,
    start,
    end,
    description,
  }: { title: string; start: string; end: string; description?: string }
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar createEvent failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  return { id: data.id as string, htmlLink: data.htmlLink as string }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a local date+time string in a given timezone to a UTC ISO string.
 * Uses the Intl offset trick: compare what the naive Date looks like in UTC
 * vs the target timezone to derive the UTC offset, then apply it.
 */
function toUtc(dateStr: string, timeStr: string, timezone: string): string {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const utcDate  = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }))
  const localDate = new Date(naive.toLocaleString('en-US', { timeZone: timezone }))
  const offsetMs = utcDate.getTime() - localDate.getTime()
  return new Date(naive.getTime() + offsetMs).toISOString()
}

/**
 * Parse a local date+time string in a given timezone into a UTC Date object.
 * Used to build correct slot start/end cursors.
 */
function parseLocalTime(dateStr: string, timeStr: string, timezone: string): Date {
  return new Date(toUtc(dateStr, timeStr, timezone))
}

function formatLocal(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
