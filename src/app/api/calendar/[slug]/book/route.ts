import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots, createEvent } from '@/lib/google-calendar'

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
    .select('google_refresh_token, google_calendar_id, booking_service_duration_minutes, booking_buffer_minutes, timezone, booking_enabled, business_name')
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
    // Match the requested time (accept partial match — "2:00 PM" vs "2:00 PM")
    const matchedSlot = freshSlots.find(s =>
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
      })
    }

    const title = `${service || 'Appointment'} — ${resolvedCallerName}`
    const description = [
      service ? `Service: ${service}` : null,
      callerPhone ? `Phone: ${callerPhone}` : null,
      `Booked via ${client.business_name || 'unmissed.ai'}`,
    ].filter(Boolean).join('\n')

    await createEvent(accessToken, calendarId, {
      title,
      start: matchedSlot.start,
      end: matchedSlot.end,
      description,
    })

    console.log(`[calendar/book] Booked for slug=${slug} date=${date} time=${matchedSlot.displayTime} name=${callerName}`)

    return NextResponse.json({
      booked: true,
      confirmationTime: matchedSlot.displayTime,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[calendar/book] Failed for slug=${slug}: ${msg}`)

    if (msg.includes('token refresh failed')) {
      await supabase.from('clients').update({ calendar_auth_status: 'expired' }).eq('slug', slug)
    }

    return NextResponse.json({ booked: false, reason: 'calendar_error', fallback: true })
  }
}
