import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'
  const body = await req.json().catch(() => ({}))
  const { leads, client_id } = body

  if (!Array.isArray(leads) || leads.length === 0)
    return NextResponse.json({ error: 'leads array is required' }, { status: 400 })
  if (leads.length > 500)
    return NextResponse.json({ error: 'Max 500 leads per import' }, { status: 400 })

  const targetClientId = isAdmin ? (client_id ?? null) : cu.client_id
  if (!targetClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (raw.startsWith('+')) return raw
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`
    return raw
  }

  const rows = (leads as Record<string, unknown>[])
    .filter(l => typeof l.phone === 'string' && (l.phone as string).length > 0)
    .map(l => ({
      client_id: targetClientId,
      phone: normalizePhone(l.phone as string),
      name: typeof l.name === 'string' && l.name ? l.name : null,
      notes: typeof l.notes === 'string' && l.notes ? l.notes : null,
    }))

  if (rows.length === 0)
    return NextResponse.json({ error: 'No valid leads (phone required)' }, { status: 400 })

  const { error, data } = await supabase
    .from('campaign_leads')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: data?.length ?? rows.length })
}
