import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Handles recovery/magic-link tokens from Supabase emails.
// Called from our own email links as:
//   /auth/confirm?token_hash=TOKEN&type=recovery&next=/dashboard
// This avoids the Supabase redirect-allowlist requirement entirely.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'recovery') as 'recovery' | 'email' | 'invite'
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    console.error('[auth/confirm] verifyOtp failed:', error.message)
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
}
