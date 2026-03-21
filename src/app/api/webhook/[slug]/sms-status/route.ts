import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature } from '@/lib/twilio'
import { APP_URL } from '@/lib/app-url'

export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const messageSid = body.MessageSid || ''
  const messageStatus = body.MessageStatus || ''
  const errorCode = body.ErrorCode || ''

  console.log(`[sms-status] slug=${slug} sid=${messageSid} status=${messageStatus} errorCode=${errorCode || 'none'}`)

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/sms-status`
  if (!validateSignature(signature, url, body)) {
    console.error(`[sms-status] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!messageSid) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const supabase = createServiceClient()

  const { error: updateError } = await supabase
    .from('sms_logs')
    .update({
      delivery_status: messageStatus,
      delivery_error_code: errorCode || null,
      status: messageStatus === 'delivered' ? 'delivered'
        : messageStatus === 'failed' || messageStatus === 'undelivered' ? messageStatus
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('message_sid', messageSid)

  if (updateError) {
    console.error(`[sms-status] Update failed for sid=${messageSid}: ${updateError.message}`)
  } else {
    console.log(`[sms-status] Updated: sid=${messageSid} status=${messageStatus}`)
  }

  return new NextResponse('OK', { status: 200 })
}
