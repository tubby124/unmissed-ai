import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // On Railway, request.url has localhost as origin — use forwarded headers for the real public URL
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:8080'
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  if (code) {
    // Create the redirect response first so we can set session cookies directly on it
    const redirectResponse = NextResponse.redirect(new URL(next, baseUrl))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', baseUrl))
}
