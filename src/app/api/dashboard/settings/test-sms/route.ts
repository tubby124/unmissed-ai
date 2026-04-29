import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import twilio from 'twilio'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))
  const toPhone = body.to_phone as string | undefined
  if (!toPhone) {
    return NextResponse.json({ ok: false, error: 'to_phone is required' }, { status: 400 })
  }

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied
  const targetClientId = scope.targetClientId

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
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/settings/test-sms',
        method: 'POST',
        payload: { client_id: targetClientId, to_phone: toPhone },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[test-sms] Send failed:', msg)
    if (scope.guard.isCrossClient) {
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/settings/test-sms',
        method: 'POST',
        payload: { client_id: targetClientId, to_phone: toPhone },
        status: 'error',
        errorMessage: msg,
      })
    }
    return NextResponse.json({ ok: false, error: msg })
  }
}
