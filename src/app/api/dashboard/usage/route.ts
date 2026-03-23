import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  if (cu.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.ultravox.ai/api/accounts/me/billing/usage', {
    headers: { 'X-API-Key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    return NextResponse.json(
      { error: `Ultravox API error: ${res.status}` },
      { status: 502 }
    )
  }

  const usage = await res.json()
  return NextResponse.json({ usage })
}
