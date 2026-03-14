import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createDemoCall } from '@/lib/ultravox'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature, buildStreamTwiml } from '@/lib/twilio'
import { DEMO_AGENTS } from '@/lib/demo-prompts'

const IVR_MENU: Record<string, string> = {
  '1': 'auto_glass',
  '2': 'property_mgmt',
  '3': 'voicemail',
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const callerPhone = body.From || 'unknown'
  const digits = body.Digits || ''

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/demo/inbound`
  if (!validateSignature(signature, url, body)) {
    console.error(`[demo-ivr] Twilio signature FAILED`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // No digits yet = first call in, play IVR menu
  if (!digits) {
    console.log(`[demo-ivr] New call from ${callerPhone} — playing IVR menu`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/demo/inbound" method="POST" timeout="8">
    <Say voice="Polly.Joanna">Welcome to unmissed dot A I. Press 1 to talk to an auto glass receptionist. Press 2 for a property management assistant. Press 3 for a real estate voicemail agent.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We didn't get your selection. Goodbye.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Digits received — route to demo agent
  const demoId = IVR_MENU[digits]
  if (!demoId || !DEMO_AGENTS[demoId]) {
    console.log(`[demo-ivr] Invalid digit: ${digits}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, that wasn't a valid option. Goodbye.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  const demo = DEMO_AGENTS[demoId]
  console.log(`[demo-ivr] Digit ${digits} → ${demoId} (${demo.companyName}), caller=${callerPhone}`)

  const promptWithContext = demo.systemPrompt + `\n\n[DEMO MODE — This is a 2-minute demo call via phone. Be concise and showcase the agent's capabilities. CALLER PHONE: ${callerPhone}]`

  try {
    const call = await createDemoCall({
      systemPrompt: promptWithContext,
      voice: demo.voiceId,
      useTwilio: true,
    })

    console.log(`[demo-ivr] Ultravox call created: callId=${call.callId}`)

    // Log phone demo call (fire-and-forget)
    const supabase = createServiceClient()
    const ipHash = crypto.createHash('sha256').update(callerPhone).digest('hex').slice(0, 16)
    supabase.from('demo_calls').insert({
      demo_id: demoId,
      caller_name: callerPhone,
      ultravox_call_id: call.callId,
      source: 'phone',
      ip_hash: ipHash,
    }).then(({ error }) => {
      if (error) console.error(`[demo-ivr] Failed to log demo call: ${error.message}`)
    })

    const twiml = buildStreamTwiml(call.joinUrl)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    console.error(`[demo-ivr] Ultravox call creation failed: ${err}`)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, we're experiencing technical difficulties. Please try again later or visit unmissed dot A I.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
