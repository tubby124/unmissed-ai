import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessToken, listSlots } from '@/lib/google-calendar'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
      (client.booking_service_duration_minutes as number) || 60,
      (client.booking_buffer_minutes as number) || 15,
      '09:00',
      '18:00',
      3,
      time || undefined,
    )
    return NextResponse.json({ available: slots.length > 0, slots })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[calendar/slots] Failed for slug=${slug}: ${msg}`)

    // If token expired, update status in DB
    if (msg.includes('token refresh failed')) {
      await supabase.from('clients').update({ calendar_auth_status: 'expired' }).eq('slug', slug)
    }

    return NextResponse.json({ available: false, fallback: true, reason: 'calendar_auth_expired' })
  }
}
