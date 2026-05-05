/**
 * Gettimely OAuth callback — Phase 1A stub.
 *
 * Phase 1A: returns 501 — the start route never redirects here yet.
 * Phase 1B will:
 *   1. Verify nonce cookie matches state param
 *   2. POST to https://api.gettimely.com/oauth/token with code + client secrets
 *   3. Save refresh_token + account_id to clients row
 *   4. List staff + show staff selector page (or auto-pick if only one)
 *   5. Set booking_provider='gettimely' + calendar_auth_status='connected' + booking_enabled=true
 *   6. Patch prompt with calendar block + sync Ultravox tools (mirror google callback)
 *   7. Redirect to settings with success flag
 */
import { NextResponse } from 'next/server'
import { APP_URL } from '@/lib/app-url'

export async function GET() {
  return NextResponse.redirect(
    `${APP_URL}/dashboard/settings?calendar_error=gettimely_not_implemented`,
  )
}
