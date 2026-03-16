import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const callId = body.callId as string
  const duration = body.duration as number | undefined

  if (!callId) {
    return NextResponse.json({ error: 'Missing callId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('demo_calls')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: duration ?? null,
    })
    .eq('ultravox_call_id', callId)

  if (error) {
    console.error(`[demo-end] Failed to update demo call: ${error.message}`)
    return NextResponse.json({ error: 'Failed to log end' }, { status: 500 })
  }

  // Also insert demo_completed event
  await supabase.from('demo_events').insert({
    demo_call_id: await getDemoCallId(supabase, callId),
    event_type: 'demo_completed',
    metadata: { duration },
  })

  return NextResponse.json({ ok: true })
}

async function getDemoCallId(supabase: ReturnType<typeof createServiceClient>, ultravoxCallId: string): Promise<string | null> {
  const { data } = await supabase
    .from('demo_calls')
    .select('id')
    .eq('ultravox_call_id', ultravoxCallId)
    .single()
  return data?.id ?? null
}
