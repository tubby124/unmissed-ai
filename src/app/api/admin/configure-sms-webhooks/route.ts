/**
 * POST /api/admin/configure-sms-webhooks
 *
 * Configures Twilio SmsUrl on all active client numbers so inbound SMS
 * routes to /api/webhook/[slug]/sms-inbound.
 *
 * Auth: Basic (ADMIN_PASSWORD)
 * Optional body: { slug: "windshield-hub" } to configure one client; omit for all.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Basic ')) return false
  const encoded = authHeader.slice(6)
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  const [, password] = decoded.split(':')
  return password === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="admin"' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const targetSlug: string | undefined = body.slug

  const supabase = createServiceClient()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  let query = supabase
    .from('clients')
    .select('slug, twilio_number')
    .eq('status', 'active')
    .not('twilio_number', 'is', null)

  if (targetSlug) query = query.eq('slug', targetSlug)

  const { data: clients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ configured: [], errors: [], note: 'no matching clients' })

  // Look up Twilio SIDs for each number
  const numbersRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { Authorization: `Basic ${twilioAuth}` } }
  )
  if (!numbersRes.ok) {
    return NextResponse.json({ error: `Twilio list failed: ${numbersRes.status}` }, { status: 500 })
  }
  const numbersData = await numbersRes.json() as {
    incoming_phone_numbers: Array<{ sid: string; phone_number: string; sms_url: string | null }>
  }

  const numberMap = new Map(numbersData.incoming_phone_numbers.map(n => [n.phone_number, n]))

  const configured: string[] = []
  const skipped: string[] = []
  const errors: { slug: string; error: string }[] = []

  await Promise.all(clients.map(async (client) => {
    const entry = numberMap.get(client.twilio_number)
    if (!entry) {
      errors.push({ slug: client.slug, error: `Number ${client.twilio_number} not found in Twilio` })
      return
    }

    const smsUrl = `${appUrl}/api/webhook/${client.slug}/sms-inbound`

    // Skip if already configured
    if (entry.sms_url === smsUrl) {
      skipped.push(`${client.slug} (already configured)`)
      return
    }

    try {
      const patchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${entry.sid}.json`
      const patchBody = new URLSearchParams({
        SmsUrl: smsUrl,
        SmsMethod: 'POST',
      })
      const patchRes = await fetch(patchUrl, {
        method: 'POST',
        headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: patchBody.toString(),
      })

      if (patchRes.ok) {
        configured.push(client.slug)
        console.log(`[configure-sms-webhooks] Configured ${client.slug} (${client.twilio_number}) → ${smsUrl}`)
      } else {
        const errText = await patchRes.text()
        errors.push({ slug: client.slug, error: `Twilio PATCH ${patchRes.status}: ${errText.slice(0, 200)}` })
      }
    } catch (err) {
      errors.push({ slug: client.slug, error: String(err).slice(0, 200) })
    }
  }))

  console.log(`[configure-sms-webhooks] Done — configured=${configured.length} skipped=${skipped.length} errors=${errors.length}`)
  return NextResponse.json({ configured, skipped, errors })
}
