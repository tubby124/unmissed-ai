import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_EVENTS = ['demo_started', 'demo_completed', 'onboard_clicked', 'signup_started'] as const

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const callId = body.callId as string
  const eventType = body.eventType as string
  const metadata = (body.metadata as Record<string, unknown>) || {}

  if (!callId || !eventType) {
    return NextResponse.json({ error: 'Missing callId or eventType' }, { status: 400 })
  }

  if (!VALID_EVENTS.includes(eventType as typeof VALID_EVENTS[number])) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Look up demo_call row by ultravox_call_id
  const { data: demoCall } = await supabase
    .from('demo_calls')
    .select('id')
    .eq('ultravox_call_id', callId)
    .single()

  if (!demoCall) {
    // Call might not be logged yet (race condition) — still insert with null FK
    console.warn(`[demo-event] No demo_call found for callId=${callId}, inserting event without FK`)
  }

  const { error } = await supabase.from('demo_events').insert({
    demo_call_id: demoCall?.id ?? null,
    event_type: eventType,
    metadata,
  })

  if (error) {
    console.error(`[demo-event] Insert failed: ${error.message}`)
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
  }

  // Mark as converted if onboard_clicked
  if (eventType === 'onboard_clicked' && demoCall?.id) {
    await supabase
      .from('demo_calls')
      .update({ converted: true })
      .eq('id', demoCall.id)
  }

  return NextResponse.json({ ok: true })
}
