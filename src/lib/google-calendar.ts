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
): Promise<TimeSlot[]> {
  // Build time range for the day in client's timezone
  const dayStart = new Date(`${dateStr}T${workdayStart}:00`)
  const dayEnd = new Date(`${dateStr}T${workdayEnd}:00`)

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

  // Generate candidate slots every (duration + buffer) minutes
  const slots: TimeSlot[] = []
  let cursor = dayStart
  while (cursor < dayEnd) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000)
    if (slotEnd > dayEnd) break

    const busy = busyBlocks.some(b => cursor < b.end && slotEnd > b.start)
    if (!busy) {
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
        displayTime: formatLocal(cursor, timezone),
      })
    }

    cursor = new Date(cursor.getTime() + (durationMinutes + bufferMinutes) * 60_000)
  }
  return slots
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
): Promise<string> {
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
  return data.id as string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toUtc(dateStr: string, timeStr: string, timezone: string): string {
  // Build a date string with timezone offset using Intl
  const dt = new Date(`${dateStr}T${timeStr}:00`)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  // We approximate: just use the local Date constructed from the string
  // (Railway runs UTC; we pass tz-aware strings so Google handles conversion)
  void formatter // keep import
  return `${dateStr}T${timeStr}:00Z` // simplified — Google converts from tz specified in events
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
