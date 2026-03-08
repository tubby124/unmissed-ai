import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createCall, callViaAgent } from '@/lib/ultravox'
import twilio from 'twilio'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = body.client_id ?? cu.client_id
  const toPhone: string = body.to_phone

  if (!toPhone) return NextResponse.json({ error: 'to_phone required (E.164 format)' }, { status: 400 })

  // Fetch client config
  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, ultravox_agent_id, twilio_number')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system_prompt configured' }, { status: 400 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio credentials or from number not configured' }, { status: 500 })
  }

  // Create Ultravox call (no callback — test call, no processing needed)
  let ultravoxCall: { joinUrl: string; callId: string }
  try {
    if (client.ultravox_agent_id) {
      ultravoxCall = await callViaAgent(client.ultravox_agent_id, {
        metadata: { caller_phone: toPhone, client_slug: client.slug, client_id: client.id, test_call: 'true' },
      })
    } else {
      ultravoxCall = await createCall({
        systemPrompt: client.system_prompt,
        voice: client.agent_voice_id,
        metadata: { caller_phone: toPhone, client_slug: client.slug, client_id: client.id, test_call: 'true' },
      })
    }
  } catch (err) {
    return NextResponse.json({ error: `Ultravox call creation failed: ${String(err)}` }, { status: 500 })
  }

  // Dial the operator via Twilio outbound, connecting to the Ultravox stream
  const twiml = `<Response><Connect><Stream url="${ultravoxCall.joinUrl}"/></Connect></Response>`
  try {
    const twilioClient = twilio(accountSid, authToken)
    const call = await twilioClient.calls.create({
      to: toPhone,
      from: fromNumber,
      twiml,
    })
    return NextResponse.json({ ok: true, callId: ultravoxCall.callId, twilio_sid: call.sid })
  } catch (err) {
    return NextResponse.json({ error: `Twilio dial failed: ${String(err)}` }, { status: 500 })
  }
}
