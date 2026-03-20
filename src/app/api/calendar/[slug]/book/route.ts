import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots, createEvent } from '@/lib/google-calendar'
import { parseCallState, setStateUpdate, bookingInstruction } from '@/lib/call-state'

/** Normalize time strings to "H:MM AM/PM" format to match displayTime from checkCalendarAvailability */
function normalizeTime(input: string): string {
  const s = input.trim()
  // Already "H:MM AM/PM" or "HH:MM AM/PM"
  const standard = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (standard) return `${parseInt(standard[1])}:${standard[2]} ${standard[3].toUpperCase()}`
  // "9:00am" / "1:30pm" (no space)
  const compact = s.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i)
  if (compact) return `${parseInt(compact[1])}:${compact[2]} ${compact[3].toUpperCase()}`
  // "9am" / "1pm"
  const short = s.match(/^(\d{1,2})(AM|PM)$/i)
  if (short) return `${parseInt(short[1])}:00 ${short[2].toUpperCase()}`
  // 24-hour "13:00" / "09:00"
  const military = s.match(/^(\d{2}):(\d{2})$/)
  if (military) {
    const h = parseInt(military[1]), m = military[2]
    if (h === 0) return `12:${m} AM`
    if (h < 12) return `${h}:${m} AM`
    if (h === 12) return `12:${m} PM`
    return `${h - 12}:${m} PM`
  }
  return s // passthrough — match attempt will fail gracefully
}

/** Convert a time string to "HH:MM" 24-hour format for listSlots preferredTime.
 *  Handles "H:MM AM/PM", "HH:MM", and full displayTime strings like "Friday March 20 at 2:00 PM".
 *  Returns undefined if parsing fails — listSlots skips sorting gracefully. */
function toPreferredTime(input: string): string | undefined {
  // Try normalizeTime first (handles compact/short/military formats)
  const normalized = normalizeTime(input)
  // If normalizeTime returned a passthrough, extract just the time portion
  const timeStr = /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(normalized)
    ? normalized
    : (input.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i)?.[1]?.trim() ?? undefined)
  if (!timeStr) return undefined
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return undefined
  let h = parseInt(match[1])
  const m = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === 'AM' && h === 12) h = 0
  if (ampm === 'PM' && h !== 12) h += 12
  return `${h.toString().padStart(2, '0')}:${m}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // ── Auth — X-Tool-Secret ──────────────────────────────────────────────────
  const toolSecret = process.env.WEBHOOK_SIGNING_SECRET
  const providedSecret = req.headers.get('X-Tool-Secret')
  if (toolSecret && providedSecret !== toolSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // B3: Read call state from Ultravox header
  const callState = parseCallState(req)
  console.log(`[calendar/book] B3 call-state header: ${callState ? JSON.stringify(callState) : 'NULL (header missing)'}`)
  console.log(`[calendar/book] All headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`)


  const { slug } = await params
  const body = await req.json().catch(() => ({}))

  const { date, time, service, callerName, callerPhone } = body as {
    date?: string
    time?: string
    service?: string
    callerName?: string
    callerPhone?: string
  }

  if (!date || !time) {
    return NextResponse.json({ booked: false, reason: 'missing_fields' }, { status: 400 })
  }
  const resolvedCallerName = callerName || 'Caller'

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, google_refresh_token, google_calendar_id, booking_service_duration_minutes, booking_buffer_minutes, timezone, booking_enabled, business_name')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client || !client.booking_enabled || !client.google_refresh_token) {
    return NextResponse.json({ booked: false, reason: 'booking_not_available' }, { status: 404 })
  }

  try {
    const accessToken = await getAccessToken(client.google_refresh_token as string)
    const timezone = (client.timezone as string) || 'America/Chicago'
    const durationMinutes = (client.booking_service_duration_minutes as number) || 30
    const bufferMinutes = (client.booking_buffer_minutes as number) || 0
    const calendarId = (client.google_calendar_id as string) || 'primary'

    // G11: Re-verify the slot is still available before booking (race condition prevention)
    // maxSlots=1 + preferredTime sorts all slots by proximity to requested time — returns the closest match only
    const freshSlots = await listSlots(accessToken, calendarId, date, timezone, durationMinutes, bufferMinutes, '09:00', '18:00', 1, toPreferredTime(time))
    // Normalize input time to "H:MM AM/PM" before matching displayTime
    const normalizedTime = normalizeTime(time)
    const matchedSlot = freshSlots.find(s =>
      s.displayTime.toLowerCase().includes(normalizedTime.toLowerCase()) ||
      s.displayTime.toLowerCase().includes(time.toLowerCase()) ||
      s.start.includes(time)
    )

    if (!matchedSlot) {
      // Slot was taken — return next available
      const nextAvailable = freshSlots[0]?.displayTime || null
      const newAttempts = (callState?.bookingAttempts ?? 0) + 1
      const coaching = callState ? bookingInstruction({ ...callState, bookingAttempts: newAttempts }, false, true) : ''
      const baseSlotTaken = `That slot was just taken. ${nextAvailable ? `Offer ${nextAvailable} instead and ask if that works.` : 'Ask what other time works for them.'}`
      const response = NextResponse.json({
        booked: false,
        reason: 'slot_taken',
        nextAvailable,
        _instruction: coaching ? `${baseSlotTaken} ${coaching}` : baseSlotTaken,
      })
      if (callState) setStateUpdate(response, { bookingAttempts: newAttempts, lastToolOutcome: 'slot_taken' })
      return response
    }

    const title = `${service || 'Appointment'} — ${resolvedCallerName}`
    const description = [
      service ? `Service: ${service}` : null,
      callerPhone ? `Phone: ${callerPhone}` : null,
      `Booked via ${client.business_name || 'unmissed.ai'}`,
    ].filter(Boolean).join('\n')

    const event = await createEvent(accessToken, calendarId, {
      title,
      start: matchedSlot.start,
      end: matchedSlot.end,
      description,
    })

    // Store booking record so completed webhook can include calendar URL in Telegram
    // Fire-and-forget — don't block the booking confirmation on the DB write
    if (client.id) {
      supabase.from('bookings').insert({
        client_id: client.id,
        slug,
        caller_phone: callerPhone || null,
        caller_name: resolvedCallerName,
        appointment_time: matchedSlot.displayTime,
        appointment_date: date,
        service: service || null,
        calendar_url: event.htmlLink || null,
      }).then(({ error }) => { if (error) console.error('[calendar/book] booking record failed:', error.message) })
    }

    console.log(`[calendar/book] Booked for slug=${slug} date=${date} time=${matchedSlot.displayTime} name=${callerName} calendarUrl=${event.htmlLink}`)

    const newAttempts = (callState?.bookingAttempts ?? 0) + 1
    const response = NextResponse.json({
      booked: true,
      confirmationTime: matchedSlot.displayTime,
      calendarUrl: event.htmlLink || null,
      _instruction: `Booked for ${date} at ${matchedSlot.displayTime}. Confirm the date and time back to the caller and ask if there's anything else.`,
    })
    // Force agent to speak immediately after booking — confirms back to caller
    response.headers.set('X-Ultravox-Agent-Reaction', 'speaks')
    if (callState) setStateUpdate(response, { bookingAttempts: newAttempts, lastToolOutcome: 'booked' })
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[calendar/book] Failed for slug=${slug}: ${msg}`)

    if (msg.includes('token refresh failed')) {
      await supabase.from('clients').update({ calendar_auth_status: 'expired' }).eq('slug', slug)
    }

    const errNewAttempts = (callState?.bookingAttempts ?? 0) + 1
    const errCoaching = callState ? bookingInstruction({ ...callState, bookingAttempts: errNewAttempts }, false, false) : ''
    const errBase = `Booking failed — tell the caller you'll have someone follow up to confirm their appointment.`
    const errResponse = NextResponse.json({ booked: false, reason: 'calendar_error', fallback: true,
      _instruction: errCoaching ? `${errBase} ${errCoaching}` : errBase,
    })
    if (callState) setStateUpdate(errResponse, { bookingAttempts: errNewAttempts, lastToolOutcome: 'booking_error' })
    return errResponse
  }
}
