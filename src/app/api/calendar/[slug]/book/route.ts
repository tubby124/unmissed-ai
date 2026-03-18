import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots, createEvent } from '@/lib/google-calendar'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
    const durationMinutes = (client.booking_service_duration_minutes as number) || 60
    const bufferMinutes = (client.booking_buffer_minutes as number) || 15
    const calendarId = (client.google_calendar_id as string) || 'primary'

    // G11: Re-verify the slot is still available before booking (race condition prevention)
    const freshSlots = await listSlots(accessToken, calendarId, date, timezone, durationMinutes, bufferMinutes)
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
      return NextResponse.json({
        booked: false,
        reason: 'slot_taken',
        nextAvailable,
        _instruction: `That slot was just taken. ${nextAvailable ? `Offer ${nextAvailable} instead and ask if that works.` : 'Ask what other time works for them.'}`,
      })
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
    if (client.id) {
      await supabase.from('bookings').insert({
        client_id: client.id,
        slug,
        caller_phone: callerPhone || null,
        caller_name: resolvedCallerName,
        appointment_time: matchedSlot.displayTime,
        appointment_date: date,
        service: service || null,
        calendar_url: event.htmlLink || null,
      })
    }

    console.log(`[calendar/book] Booked for slug=${slug} date=${date} time=${matchedSlot.displayTime} name=${callerName} calendarUrl=${event.htmlLink}`)

    return NextResponse.json({
      booked: true,
      confirmationTime: matchedSlot.displayTime,
      calendarUrl: event.htmlLink || null,
      _instruction: `Appointment confirmed for ${date} at ${matchedSlot.displayTime}. Tell the caller that in one natural sentence, then ask if there's anything else, and if not, use hangUp.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[calendar/book] Failed for slug=${slug}: ${msg}`)

    if (msg.includes('token refresh failed')) {
      await supabase.from('clients').update({ calendar_auth_status: 'expired' }).eq('slug', slug)
    }

    return NextResponse.json({ booked: false, reason: 'calendar_error', fallback: true,
      _instruction: `Calendar is unavailable right now. Let the caller know you'll have someone call them back to schedule a time, and use hangUp.`,
    })
  }
}
