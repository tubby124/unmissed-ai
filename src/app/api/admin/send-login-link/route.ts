import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const TAG = '[send-login-link]'

  // ── Auth check — admin only ──────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ───────────────────────────────────────────────────────────
  const { clientSlug } = await req.json()
  if (!clientSlug) {
    return NextResponse.json({ error: 'Missing clientSlug' }, { status: 400 })
  }

  // ── Look up client ───────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await adminSupa
    .from('clients')
    .select('id, contact_email, twilio_number')
    .eq('slug', clientSlug)
    .single()

  if (clientErr || !client) {
    console.error(`${TAG} Client not found: slug=${clientSlug}`, clientErr)
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const contactEmail = client.contact_email
  if (!contactEmail) {
    return NextResponse.json({ error: 'Client has no contact_email' }, { status: 400 })
  }

  const twilioNumber = client.twilio_number as string | null

  // ── Look up callback_phone from latest intake_submissions ────────────────
  const { data: intake } = await adminSupa
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', clientSlug)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const intakeJson = (intake?.intake_json as Record<string, unknown> | null) ?? {}
  const callbackPhone = (intakeJson.callback_phone as string | null) || null

  // ── Generate recovery link ───────────────────────────────────────────────
  const { data: linkData, error: linkErr } = await adminSupa.auth.admin.generateLink({
    type: 'recovery',
    email: contactEmail,
  })

  if (linkErr || !linkData?.properties?.action_link) {
    console.error(`${TAG} generateLink failed for ${contactEmail}:`, linkErr)
    return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  let setupUrl = `${appUrl}/dashboard`

  try {
    const parsed = new URL(linkData.properties.action_link)
    const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
    if (tokenHash) {
      setupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
    }
  } catch {
    console.warn(`${TAG} Could not parse action_link — using fallback URL`)
    setupUrl = `${appUrl}/login`
  }

  // ── Send via SMS if we have both numbers ─────────────────────────────────
  let sentViaSms = false
  let sentTo: string | null = null

  if (twilioNumber && callbackPhone) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      console.error(`${TAG} TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set — skipping SMS`)
    } else {
      try {
        const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        const smsBody = new URLSearchParams({
          From: twilioNumber,
          To: callbackPhone,
          Body: `Set up your unmissed.ai dashboard password:\n${setupUrl}\n\nThis link expires in 24 hours.`,
        })

        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: smsBody.toString(),
          }
        )

        if (smsRes.ok) {
          sentViaSms = true
          sentTo = callbackPhone
          console.log(`${TAG} Login link SMS sent to ${callbackPhone} from ${twilioNumber}`)
        } else {
          const errText = await smsRes.text()
          console.error(`${TAG} SMS failed for slug=${clientSlug}: ${errText.slice(0, 200)}`)
        }
      } catch (err) {
        console.error(`${TAG} SMS threw:`, err)
      }
    }
  } else {
    const reason = !twilioNumber ? 'no Twilio number on client' : 'no callbackPhone in intake'
    console.warn(`${TAG} SMS skipped for slug=${clientSlug}: ${reason}`)
  }

  console.log(`${TAG} Setup link generated for ${clientSlug} (email=${contactEmail}, sms=${sentViaSms})`)

  return NextResponse.json({
    setupUrl,
    sentViaSms,
    sentTo,
  })
}
