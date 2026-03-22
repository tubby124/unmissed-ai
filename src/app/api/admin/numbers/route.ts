/**
 * GET  /api/admin/numbers     — list all inventory numbers (admin only)
 * POST /api/admin/numbers     — add a number to inventory (admin only)
 *
 * POST body: { phone_number: string }
 * Auto-fetches Twilio SID and detects province from area code.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { extractAreaCode, detectProvinceFromAreaCode } from '@/lib/phone'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  // Join with clients to get business_name for assigned numbers
  const { data: rows, error } = await svc
    .from('number_inventory')
    .select(`
      id, phone_number, twilio_sid, province, area_code, country,
      status, assigned_client_id, reserved_intake_id, reserved_at,
      created_at,
      clients:assigned_client_id ( business_name, slug )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/numbers GET] Query error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ numbers: rows ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const body = await req.json().catch(() => ({})) as { phone_number?: string }
  const rawNumber = (body.phone_number ?? '').trim()

  if (!rawNumber) {
    return NextResponse.json({ error: 'phone_number required' }, { status: 400 })
  }

  // Normalize to E.164 format if needed
  const digits = rawNumber.replace(/\D/g, '')
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 ? `+${digits}` : rawNumber

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  // Fetch Twilio SID for this number
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(e164)}`
  const twilioRes = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${twilioAuth}` },
  })

  if (!twilioRes.ok) {
    const errText = await twilioRes.text()
    console.error('[admin/numbers POST] Twilio lookup failed:', errText)
    return NextResponse.json({ error: 'Twilio API error', detail: errText.slice(0, 200) }, { status: 502 })
  }

  const twilioData = await twilioRes.json() as { incoming_phone_numbers: { sid: string; phone_number: string }[] }
  const match = twilioData.incoming_phone_numbers?.[0]

  if (!match) {
    return NextResponse.json(
      { error: 'Number not found in your Twilio account. Check the number and try again.' },
      { status: 422 }
    )
  }

  const twilioSid = match.sid
  const areaCode  = extractAreaCode(e164) ?? ''
  const province  = areaCode ? detectProvinceFromAreaCode(areaCode) : null

  const { data: inserted, error: insertErr } = await svc
    .from('number_inventory')
    .insert({
      phone_number: e164,
      twilio_sid: twilioSid,
      area_code: areaCode || null,
      province: province,
      country: 'CA',
      status: 'available',
    })
    .select('id, phone_number, province, area_code, status')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'This number is already in inventory' }, { status: 409 })
    }
    console.error('[admin/numbers POST] Insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to add number' }, { status: 500 })
  }

  return NextResponse.json({ number: inserted }, { status: 201 })
}
