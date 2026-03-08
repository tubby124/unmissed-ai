import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const password = process.env.ADMIN_PASSWORD
    if (!password) return NextResponse.next() // no password set = open (dev only)

    const authHeader = request.headers.get('authorization')
    const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`

    if (authHeader !== expected) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="unmissed.ai admin"' },
      })
    }
  }
  return NextResponse.next()
}

export const config = { matcher: '/admin/:path*' }
