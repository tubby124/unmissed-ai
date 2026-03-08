import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createCall } from '@/lib/ultravox'
import { buildStreamTwiml } from '@/lib/twilio'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// POST — initiate an outbound call from the dashboard (no n8n)
// Flow: create Ultravox call → Twilio REST dials lead → same inbound infrastructure handles it
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { slug, phone } = body as { slug?: string; phone?: string }

  if (!slug || !phone) {
    return NextResponse.json({ error: 'slug and phone required' }, { status: 400 })
  }

  // Sanitize phone — ensure E.164 format
  const dialPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`

  // Fetch client config
  const { data: client } = await supabase
    .from('clients')
    .select('id, system_prompt, agent_voice_id, twilio_number, business_name')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'Client has no system prompt' }, { status: 400 })
  if (!client.twilio_number) return NextResponse.json({ error: 'Client has no Twilio number' }, { status: 400 })

  const completedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/completed`

  // Create Ultravox call
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    ultravoxCall = await createCall({
      systemPrompt: client.system_prompt,
      voice: client.agent_voice_id,
      callbackUrl: completedUrl,
      metadata: {
        caller_phone: dialPhone,
        client_slug: slug,
        client_id: client.id,
        direction: 'outbound',
      },
    })
  } catch (err) {
    console.error('[dial] Ultravox call creation failed:', err)
    return NextResponse.json({ error: 'Failed to create AI call' }, { status: 502 })
  }

  // Insert live row in Supabase
  const { error: insertError } = await supabase.from('call_logs').insert({
    ultravox_call_id: ultravoxCall.callId,
    client_id: client.id,
    caller_phone: dialPhone,
    call_status: 'live',
    started_at: new Date().toISOString(),
  })
  if (insertError) console.error('[dial] Live row insert failed:', insertError.message)

  // Build inline TwiML — Twilio dials lead and streams directly to Ultravox
  const twiml = buildStreamTwiml(ultravoxCall.joinUrl)

  // Create Twilio outbound call via REST API
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        To: dialPhone,
        From: client.twilio_number,
        Twiml: twiml,
      }).toString(),
    }
  )

  if (!twilioRes.ok) {
    const err = await twilioRes.text()
    console.error('[dial] Twilio call creation failed:', twilioRes.status, err)
    // Clean up the live row since call won't happen
    await supabase.from('call_logs').delete().eq('ultravox_call_id', ultravoxCall.callId)
    return NextResponse.json({ error: 'Twilio dial failed', detail: err }, { status: 502 })
  }

  const twilioData = await twilioRes.json()

  return NextResponse.json({
    ok: true,
    callId: ultravoxCall.callId,
    callSid: twilioData.sid,
    message: `Dialing ${dialPhone}…`,
  })
}
