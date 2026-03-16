import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (error || !code || !stateParam) {
    console.error(`[google-callback] OAuth error: ${error || 'missing code/state'}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=access_denied`)
  }

  let slug: string, clientId: string, nonce: string
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    slug = parsed.slug
    clientId = parsed.clientId
    nonce = parsed.nonce
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=invalid_state`)
  }

  // Verify nonce
  const cookieNonce = req.cookies.get('google_oauth_nonce')?.value
  if (!cookieNonce || cookieNonce !== nonce) {
    console.error(`[google-callback] Nonce mismatch for slug=${slug}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=invalid_state`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error(`[google-callback] Token exchange failed for slug=${slug}: ${err}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const refreshToken = tokens.refresh_token as string | undefined

  if (!refreshToken) {
    console.error(`[google-callback] No refresh_token for slug=${slug} — user may need to re-authorize`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=no_refresh_token`)
  }

  // Get the primary calendar ID
  let calendarId = 'primary'
  try {
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (calRes.ok) {
      const cal = await calRes.json()
      calendarId = cal.id || 'primary'
    }
  } catch {
    // Fall back to 'primary'
  }

  // Store in Supabase
  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('clients')
    .update({
      google_refresh_token: refreshToken,
      google_calendar_id: calendarId,
      calendar_auth_status: 'connected',
    })
    .eq('id', clientId)

  if (dbError) {
    console.error(`[google-callback] DB update failed for clientId=${clientId}: ${dbError.message}`)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_error=db_failed`)
  }

  console.log(`[google-callback] Calendar connected for slug=${slug} calendarId=${calendarId}`)

  const response = NextResponse.redirect(`${appUrl}/dashboard/settings?calendar_connected=1`)
  response.cookies.delete('google_oauth_nonce')
  return response
}
