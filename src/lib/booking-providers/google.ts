/**
 * Google Calendar booking provider — wraps the existing lib/google-calendar.ts.
 *
 * Phase 1A scaffolding: this adapter does NOT change behavior. It mirrors what
 * `/api/calendar/[slug]/{slots,book}/route.ts` already does inline today, just
 * behind the BookingProvider interface so Phase 1B can refactor those routes
 * to use a single dispatcher.
 */
import { getAccessToken, listSlots as googleListSlots, createEvent } from '@/lib/google-calendar'
import { normalizeTime, toPreferredTime } from '@/lib/calendar-time'
import type { BookingProvider } from './types'

const DEFAULT_DURATION_MINUTES = 30
const DEFAULT_BUFFER_MINUTES = 0
const DEFAULT_TIMEZONE = 'America/Chicago'

export const googleProvider: BookingProvider = {
  id: 'google',

  isConnected(client) {
    return Boolean(client.google_refresh_token)
  },

  async listSlots(client, args) {
    if (!client.google_refresh_token) {
      return []
    }
    const accessToken = await getAccessToken(client.google_refresh_token)
    const calendarId = client.google_calendar_id || 'primary'
    const timezone = client.timezone || DEFAULT_TIMEZONE
    const durationMinutes = args.durationMinutes
      ?? client.booking_service_duration_minutes
      ?? DEFAULT_DURATION_MINUTES
    const bufferMinutes = client.booking_buffer_minutes ?? DEFAULT_BUFFER_MINUTES
    const maxSlots = args.maxSlots ?? 3

    const slots = await googleListSlots(
      accessToken,
      calendarId,
      args.date,
      timezone,
      durationMinutes,
      bufferMinutes,
      '09:00',
      '18:00',
      maxSlots,
      args.preferredTime ? toPreferredTime(args.preferredTime) : undefined,
    )

    return slots.map(s => ({ start: s.start, end: s.end, displayTime: s.displayTime }))
  },

  async book(client, args) {
    if (!client.google_refresh_token) {
      return { booked: false, reason: 'auth_expired' }
    }
    const accessToken = await getAccessToken(client.google_refresh_token)
    const calendarId = client.google_calendar_id || 'primary'
    const timezone = client.timezone || DEFAULT_TIMEZONE
    const durationMinutes = client.booking_service_duration_minutes ?? DEFAULT_DURATION_MINUTES
    const bufferMinutes = client.booking_buffer_minutes ?? DEFAULT_BUFFER_MINUTES

    // Re-verify availability — race-condition guard (G11)
    const freshSlots = await googleListSlots(
      accessToken,
      calendarId,
      args.date,
      timezone,
      durationMinutes,
      bufferMinutes,
      '09:00',
      '18:00',
      1,
      toPreferredTime(args.time),
    )
    const normalizedTime = normalizeTime(args.time)
    const matchedSlot = freshSlots.find(s =>
      s.displayTime.toLowerCase().includes(normalizedTime.toLowerCase()) ||
      s.displayTime.toLowerCase().includes(args.time.toLowerCase()) ||
      s.start.includes(args.time),
    )

    if (!matchedSlot) {
      return {
        booked: false,
        reason: 'slot_taken',
        nextAvailable: freshSlots[0]?.displayTime,
      }
    }

    const title = args.service ? `${args.service} — ${args.callerName}` : args.callerName
    const description = `Booked via voice agent. Caller: ${args.callerName} ${args.callerPhone}`

    // Re-find the slot with its end time from the Google response shape
    const fullSlot = freshSlots.find(s => s.start === matchedSlot.start) ?? freshSlots[0]
    const end = fullSlot?.end ?? matchedSlot.start

    const event = await createEvent(accessToken, calendarId, {
      title,
      description,
      start: matchedSlot.start,
      end,
    })

    return {
      booked: true,
      externalId: event?.id,
      rescheduleUrl: event?.htmlLink,
    }
  },
}

