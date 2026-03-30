import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const requestedClientId = url.searchParams.get('client_id')

  // Resolve client_id and check auth
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'
  const clientId = isAdmin && requestedClientId ? requestedClientId : cu.client_id

  // Fetch last 6 months of calls (phone-only — skip browser/test calls)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: rows, error } = await supabase
    .from('call_logs')
    .select('id, caller_phone, caller_name, call_status, ai_summary, started_at, duration_seconds, sentiment, quality_score')
    .eq('client_id', clientId)
    .not('caller_phone', 'is', null)
    .neq('caller_phone', 'webrtc-test')
    .gte('started_at', sixMonthsAgo.toISOString())
    .order('started_at', { ascending: false })
    .limit(3000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by phone in TypeScript
  const byPhone = new Map<string, {
    phone: string
    name: string | null
    call_count: number
    last_call_at: string
    last_status: string | null
    last_summary: string | null
    last_sentiment: string | null
    last_quality_score: number | null
    call_ids: string[]
  }>()

  for (const row of (rows ?? [])) {
    const phone = row.caller_phone as string
    const existing = byPhone.get(phone)
    if (!existing) {
      byPhone.set(phone, {
        phone,
        name: (row.caller_name as string | null) ?? null,
        call_count: 1,
        last_call_at: row.started_at as string,
        last_status: (row.call_status as string | null) ?? null,
        last_summary: (row.ai_summary as string | null) ?? null,
        last_sentiment: (row.sentiment as string | null) ?? null,
        last_quality_score: (row.quality_score as number | null) ?? null,
        call_ids: [row.id as string],
      })
    } else {
      existing.call_count++
      existing.call_ids.push(row.id as string)
      // name: use most recent non-null
      if (!existing.name && row.caller_name) {
        existing.name = row.caller_name as string
      }
      // last_call_at is already the most recent (rows are DESC)
    }
  }

  // Check VIP contacts to annotate
  const { data: vips } = await supabase
    .from('client_vip_contacts')
    .select('phone, name, relationship')
    .eq('client_id', clientId)

  const vipMap = new Map<string, { name: string; relationship: string | null }>()
  for (const v of (vips ?? [])) {
    vipMap.set(v.phone as string, { name: v.name as string, relationship: (v.relationship as string | null) ?? null })
  }

  const contacts = Array.from(byPhone.values()).map(c => ({
    phone: c.phone,
    name: vipMap.has(c.phone) ? vipMap.get(c.phone)!.name : (c.name ?? null),
    call_count: c.call_count,
    last_call_at: c.last_call_at,
    last_status: c.last_status,
    last_summary: c.last_summary,
    last_sentiment: c.last_sentiment,
    last_quality_score: c.last_quality_score,
    is_vip: vipMap.has(c.phone),
    vip_relationship: vipMap.has(c.phone) ? vipMap.get(c.phone)!.relationship : null,
  }))

  // Sort: VIPs first, then by call count desc
  contacts.sort((a, b) => {
    if (a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1
    return b.call_count - a.call_count
  })

  return NextResponse.json({ contacts, total: contacts.length })
}
