import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots, createEvent } from '@/lib/google-calendar'
import { parseCallState, setStateUpdate, bookingInstruction, readCallStateFromDb, persistCallStateToDb } from '@/lib/call-state'
import { normalizeTime, toPreferredTime } from '@/lib/calendar-time'

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

  // B3: Read call state — header first (createCall), DB fallback (Agents API lacks initialState)
  let callState = parseCallState(req)
  console.log(`[calendar/book] B3 call-state header: ${callState ? 'PRESENT' : 'NULL'}`)

  const { slug } = await params
  const body = await req.json().catch(() => ({}))

  const { date, time, service, callerName, callerPhone, call_id: callId } = body as {
    date?: string
    time?: string
    service?: string
    callerName?: string
    callerPhone?: string
    call_id?: string
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

  // DB fallback: Agents API doesn't inject X-Call-State (no initialState support)
  if (!callState && callId) callState = await readCallStateFromDb(supabase, callId)
  console.log(`[calendar/book] resolved call-state: ${callState ? 'PRESENT' : 'NULL'}`)

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
      if (callId) persistCallStateToDb(supabase, callId, callState, { bookingAttempts: newAttempts, lastToolOutcome: 'slot_taken' })
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
    if (callId) persistCallStateToDb(supabase, callId, callState, { bookingAttempts: newAttempts, lastToolOutcome: 'booked' })
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
    if (callId) persistCallStateToDb(supabase, callId, callState, { bookingAttempts: errNewAttempts, lastToolOutcome: 'booking_error' })
    return errResponse
  }
}
