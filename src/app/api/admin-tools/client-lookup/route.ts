/**
 * Admin tool: look up a single client by slug, business name, or phone.
 * Auth: X-Tool-Secret + call.metadata.adminMode === 'true'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminCall, checkToolSecret } from '@/lib/admin-tools'

export async function POST(req: NextRequest) {
  const secretError = checkToolSecret(req.headers.get('x-tool-secret'))
  if (secretError) return NextResponse.json({ error: secretError }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { call_id?: string; query?: string }
  if (!(await verifyAdminCall(body.call_id))) {
    return NextResponse.json({ ok: false, message: "I can't run that — admin queries are only allowed in admin mode." })
  }

  const raw = (body.query ?? '').trim()
  if (!raw) {
    return NextResponse.json({ ok: false, message: 'I need a slug, business name, or phone number to look up a client.' })
  }

  const supabase = createServiceClient()
  const isPhonish = /^\+?\d[\d\s\-()]*$/.test(raw)
  const digits = raw.replace(/\D/g, '')

  // Try: exact slug, then ILIKE business_name, then phone digits match
  let { data: rows } = await supabase
    .from('clients')
    .select('id, slug, business_name, agent_name, selected_plan, subscription_status, monthly_minute_limit, minutes_used_this_month, twilio_number, niche, first_call_at, status')
    .eq('slug', raw.toLowerCase())
    .limit(1)

  if ((!rows || rows.length === 0)) {
    const { data: byName } = await supabase
      .from('clients')
      .select('id, slug, business_name, agent_name, selected_plan, subscription_status, monthly_minute_limit, minutes_used_this_month, twilio_number, niche, first_call_at, status')
      .ilike('business_name', `%${raw}%`)
      .order('minutes_used_this_month', { ascending: false })
      .limit(3)
    rows = byName ?? []
  }

  if ((!rows || rows.length === 0) && isPhonish && digits.length >= 4) {
    const last10 = digits.slice(-10)
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id, slug, business_name, agent_name, selected_plan, subscription_status, monthly_minute_limit, minutes_used_this_month, twilio_number, niche, first_call_at, status')
      .ilike('twilio_number', `%${last10}%`)
      .limit(3)
    rows = byPhone ?? []
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, message: `No client found matching "${raw}".` })
  }

  const lines: string[] = []
  for (const c of rows) {
    const mins = (c.minutes_used_this_month as number | null) ?? 0
    const limit = (c.monthly_minute_limit as number | null) ?? 0
    const plan = (c.selected_plan as string | null) ?? '?'
    const sub = (c.subscription_status as string | null) ?? '?'
    const tw = (c.twilio_number as string | null) ?? 'no number'
    const niche = (c.niche as string | null) ?? '?'
    lines.push(
      `${c.business_name} (slug: ${c.slug}) — ${plan} plan, ${sub}, niche ${niche}. Twilio ${tw}. ${mins} of ${limit} minutes used this month.`
    )
  }
  return NextResponse.json({ ok: true, message: lines.join('\n') })
}
