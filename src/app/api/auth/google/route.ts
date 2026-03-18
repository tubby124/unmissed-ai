import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const clientId = req.nextUrl.searchParams.get('client_id') || cu.client_id
  // Verify admin or owner
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('slug')
    .eq('id', clientId)
    .single()

  if (!clientRow) return new NextResponse('Client not found', { status: 404 })

  const isAdmin = cu.role === 'admin' && req.nextUrl.searchParams.has('client_id')
  const nonce = crypto.randomUUID()
  const state = Buffer.from(JSON.stringify({ slug: clientRow.slug, nonce, clientId, isAdmin })).toString('base64url')

  // Store nonce in cookie for CSRF verification
  const response = NextResponse.redirect(buildOAuthUrl(state))
  response.cookies.set('google_oauth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}

function buildOAuthUrl(state: string): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}
