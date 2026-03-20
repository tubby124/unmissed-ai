import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots } from '@/lib/google-calendar'
import { parseCallState, setStateUpdate, slotInstruction } from '@/lib/call-state'
import { requestedTimeMatchesSlot } from '@/lib/calendar-time'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // ── Auth — X-Tool-Secret ──────────────────────────────────────────────────
  const toolSecret = process.env.WEBHOOK_SIGNING_SECRET
  const providedSecret = req.headers.get('X-Tool-Secret')
  if (toolSecret && providedSecret !== toolSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // B3: Read call state from Ultravox header (null if not available)
  const callState = parseCallState(req)
  console.log(`[slots] B3 call-state: ${callState ? JSON.stringify(callState) : 'NOT_PRESENT'}`)
  console.log(`[slots] All headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`)

  const { slug } = await params
  const date = req.nextUrl.searchParams.get('date')  // YYYY-MM-DD
  const time = req.nextUrl.searchParams.get('time')  // HH:MM (24h) — optional preferred time

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ available: false, reason: 'invalid_date' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('google_refresh_token, google_calendar_id, booking_service_duration_minutes, booking_buffer_minutes, timezone, booking_enabled')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client || !client.booking_enabled) {
    return NextResponse.json({ available: false, reason: 'booking_not_enabled' }, { status: 404 })
  }

  if (!client.google_refresh_token) {
    return NextResponse.json({ available: false, fallback: true, reason: 'calendar_auth_expired' })
  }

  try {
    const accessToken = await getAccessToken(client.google_refresh_token as string)
    const slots = await listSlots(
      accessToken,
      (client.google_calendar_id as string) || 'primary',
      date,
      (client.timezone as string) || 'America/Chicago',
      (client.booking_service_duration_minutes as number) || 30,
      (client.booking_buffer_minutes as number) || 0,
      '09:00',
      '18:00',
      3,
      time || undefined,
    )
    if (slots.length === 0) {
      const newAttempts = (callState?.slotAttempts ?? 0) + 1
      const coaching = callState ? slotInstruction({ ...callState, slotAttempts: newAttempts }, false) : ''
      const baseInstruction = `No available slots found. Apologize and offer to have someone call back with more options.`
      const response = NextResponse.json({
        available: false,
        slots: [],
        _instruction: coaching ? `${baseInstruction} ${coaching}` : baseInstruction,
      })
      if (callState) setStateUpdate(response, { slotAttempts: newAttempts, lastToolOutcome: 'no_slots' })
      return response
    }
    const slotList = slots.map(s => s.displayTime).join(', ')
    const newAttempts = (callState?.slotAttempts ?? 0) + 1
    const coaching = callState ? slotInstruction({ ...callState, slotAttempts: newAttempts }, true) : ''
    // If the caller requested a specific time and it's the first result, confirm it directly
    const requestedTimeMatches = requestedTimeMatchesSlot(time, slots[0])
    const baseInstruction = requestedTimeMatches
      ? `The caller's requested time is available. Confirm it directly and proceed to booking — do not offer other options.`
      : `Available slots: ${slotList}. Read 2-3 options naturally — don't list all of them. Ask which works best.`
    const response = NextResponse.json({
      available: true,
      slots,
      _instruction: coaching ? `${baseInstruction} ${coaching}` : baseInstruction,
    })
    if (callState) setStateUpdate(response, { slotAttempts: newAttempts, lastToolOutcome: 'slots_found' })
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[calendar/slots] Failed for slug=${slug}: ${msg}`)

    // If token expired, update status in DB
    if (msg.includes('token refresh failed')) {
      await supabase.from('clients').update({ calendar_auth_status: 'expired' }).eq('slug', slug)
    }

    const response = NextResponse.json({ available: false, fallback: true, reason: 'calendar_auth_expired',
      _instruction: `Calendar is unavailable right now. Let the caller know you'll have someone call them back to schedule, and use hangUp.`,
    })
    if (callState) setStateUpdate(response, { lastToolOutcome: 'calendar_unavailable' })
    return response
  }
}
