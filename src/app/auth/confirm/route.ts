import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Handles recovery/magic-link tokens from Supabase emails.
// Called from our own email links as:
//   /auth/confirm?token_hash=TOKEN&type=recovery&next=/dashboard
// This avoids the Supabase redirect-allowlist requirement entirely.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'recovery') as 'recovery' | 'email' | 'invite'
  const next = searchParams.get('next') ?? '/dashboard'

  // On Railway, request.url has localhost as origin — use forwarded headers for the real public URL
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:8080'
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  if (!token_hash) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', baseUrl))
  }

  // Collect cookies during verifyOtp so we can set them on the redirect response
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) { pendingCookies.push(...cookiesToSet) },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error) {
    console.error('[auth/confirm] verifyOtp failed:', error.message)
    return NextResponse.redirect(new URL('/login?error=invalid_link', baseUrl))
  }

  const destination = type === 'recovery' ? '/auth/set-password' : next
  const response = NextResponse.redirect(new URL(destination, baseUrl))

  // Set session cookies directly on the redirect response (same pattern as auth/callback)
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  }

  return response
}
