/**
 * Gettimely OAuth start — Phase 1A stub.
 *
 * Phase 1A: redirects to settings with `gettimely_pending=1` so the UI can
 * show a "Coming soon" toast. Real OAuth lives in Phase 1B.
 *
 * Phase 1B will:
 *   1. Authenticate via Supabase + lookup client_users (mirrors /api/auth/google)
 *   2. Build state + nonce for CSRF
 *   3. Redirect to https://api.gettimely.com/oauth/authorize?...
 *   4. Set gettimely_oauth_nonce cookie for callback verification
 */
import { NextResponse } from 'next/server'
import { APP_URL } from '@/lib/app-url'

export async function GET() {
  return NextResponse.redirect(`${APP_URL}/dashboard/settings?gettimely_pending=1`)
}
