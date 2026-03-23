import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

async function getSupabaseUser(request: NextRequest) {
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
  return { supabase, user, response }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── /dashboard/* — Supabase session auth ───────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    const { supabase, user, response } = await getSupabaseUser(request)

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Auto-link: if user has no client_users row, check if their email matches a client
    if (user.email) {
      const { data: cu } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', user.id)
        .order('role').limit(1)
        .maybeSingle()

      if (!cu) {
        const { data: matchedClient } = await supabase
          .from('clients')
          .select('id')
          .eq('contact_email', user.email)
          .limit(1)
          .maybeSingle()

        if (matchedClient) {
          // Use service role to bypass RLS for insert
          const svcSupa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
          )
          await svcSupa
            .from('client_users')
            .upsert(
              { user_id: user.id, client_id: matchedClient.id, role: 'owner' },
              { onConflict: 'user_id,client_id' }
            )
          console.log(`[middleware] Auto-linked user ${user.email} to client ${matchedClient.id}`)
        }
      }
    }

    // Trial-locked route protection — server-side redirect before page renders
    const TRIAL_LOCKED_PATHS = [
      '/dashboard/insights',
      '/dashboard/live',
      '/dashboard/leads',
      '/dashboard/calendar',
      '/dashboard/notifications',
    ]

    if (TRIAL_LOCKED_PATHS.some(p => pathname.startsWith(p))) {
      const { data: cu } = await supabase
        .from('client_users')
        .select('role, client_id')
        .eq('user_id', user.id)
        .order('role').limit(1)
        .maybeSingle()

      if (cu && cu.role !== 'admin' && cu.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('subscription_status')
          .eq('id', cu.client_id)
          .single()

        if (client?.subscription_status === 'trialing') {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard/settings'
          url.searchParams.set('tab', 'billing')
          return NextResponse.redirect(url)
        }
      }
    }

    response.headers.set('x-pathname', pathname)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
