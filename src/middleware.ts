import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── /admin/* — keep Basic Auth for Hasan's internal access ─────────────────
  if (pathname.startsWith('/admin')) {
    const password = process.env.ADMIN_PASSWORD
    if (!password) return new NextResponse('Server misconfiguration: ADMIN_PASSWORD not set', { status: 500 })

    const authHeader = request.headers.get('authorization')
    const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`

    if (authHeader !== expected) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="unmissed.ai admin"' },
      })
    }
    return NextResponse.next()
  }

  // ── /dashboard/* — Supabase session auth ───────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
}
