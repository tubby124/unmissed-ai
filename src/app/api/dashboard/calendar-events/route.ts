import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/google-calendar'

// ── Shared auth helper (same pattern as contacts route) ────────────────────
async function resolveAuth(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!cu) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user, cu, isAdmin: cu.role === 'admin' }
}

// ── GET — upcoming calendar events ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const auth = await resolveAuth(supabase)
  if ('error' in auth) return auth.error
  const { cu, isAdmin } = auth

  const requestedClientId = req.nextUrl.searchParams.get('client_id')
  const clientId = isAdmin && requestedClientId ? requestedClientId : cu.client_id

  // Fetch calendar config from client row
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('google_refresh_token, google_calendar_id, calendar_auth_status, timezone')
    .eq('id', clientId)
    .limit(1)
    .maybeSingle()

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 })
  }

  if (!client || client.calendar_auth_status !== 'connected' || !client.google_refresh_token) {
    return NextResponse.json({ events: [], connected: false })
  }

  const calendarId = client.google_calendar_id || 'primary'

  try {
    const accessToken = await getAccessToken(client.google_refresh_token)

    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 86400000)
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: weekLater.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '20',
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
    )

    if (!res.ok) {
      const status = res.status
      if (status === 401) {
        return NextResponse.json({ events: [], connected: false, error: 'token_expired' })
      }
      console.error(`[calendar-events] Google API error: ${status}`)
      return NextResponse.json({ events: [], connected: true, error: 'google_api_error' })
    }

    const data = await res.json()
    const events = (data.items || []).map((ev: {
      id?: string
      summary?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
      attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
      location?: string
    }) => ({
      id: ev.id,
      summary: ev.summary || '(No title)',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      attendees: ev.attendees?.map(a => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus,
      })),
      location: ev.location,
    }))

    return NextResponse.json({ events, connected: true })
  } catch (err) {
    console.error('[calendar-events] Error fetching events:', err)
    return NextResponse.json({ events: [], connected: true, error: 'fetch_failed' })
  }
}
