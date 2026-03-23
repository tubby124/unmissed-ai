import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const toPhone = body.to_phone as string | undefined
  if (!toPhone) {
    return NextResponse.json({ ok: false, error: 'to_phone is required' }, { status: 400 })
  }

  const targetClientId = (cu.role === 'admin' && body.client_id) ? body.client_id : cu.client_id

  // Use service client to read twilio_number (infrastructure field)
  const service = createServiceClient()
  const { data: client } = await service
    .from('clients')
    .select('business_name, sms_template, twilio_number')
    .eq('id', targetClientId)
    .single()

  if (!client?.twilio_number) {
    return NextResponse.json({ ok: false, error: 'Twilio number not configured for this client' })
  }
  if (!client?.sms_template) {
    return NextResponse.json({ ok: false, error: 'SMS template not configured for this client' })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    return NextResponse.json({ ok: false, error: 'Twilio credentials not configured' })
  }

  const smsBody = (client.sms_template as string)
    .replace('{{business}}', client.business_name || '')
    .replace('{{summary}}', '[test — no call summary]')

  try {
    const twilioClient = twilio(accountSid, authToken)
    await twilioClient.messages.create({
      body: smsBody,
      from: client.twilio_number as string,
      to: toPhone,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[test-sms] Send failed:', msg)
    return NextResponse.json({ ok: false, error: msg })
  }
}
