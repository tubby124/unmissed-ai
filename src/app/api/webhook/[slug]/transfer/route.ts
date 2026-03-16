import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirectCall } from '@/lib/twilio'

export const maxDuration = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Verify shared secret — Ultravox sends this as a static header
  const secret = req.headers.get('x-transfer-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let call_id: string | undefined
  try {
    const body = await req.json()
    call_id = body.call_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch forwarding_number for this client
  const { data: client } = await supabase
    .from('clients')
    .select('id, forwarding_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.forwarding_number) {
    console.error(`[transfer] No forwarding_number for slug=${slug}`)
    return NextResponse.json({ error: 'No forwarding number configured' }, { status: 404 })
  }

  // Look up Twilio callSid from call_logs
  const { data: log } = await supabase
    .from('call_logs')
    .select('twilio_call_sid')
    .eq('ultravox_call_id', call_id)
    .eq('client_id', client.id)
    .limit(1)
    .single()

  if (!log?.twilio_call_sid) {
    console.error(`[transfer] No twilio_call_sid for call_id=${call_id} slug=${slug}`)
    return NextResponse.json({ error: 'Call SID not found' }, { status: 404 })
  }

  try {
    await redirectCall(log.twilio_call_sid, client.forwarding_number)
    console.log(`[transfer] Redirected callSid=${log.twilio_call_sid} to ${client.forwarding_number} for slug=${slug}`)
    return NextResponse.json({ result: 'Transfer initiated' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[transfer] Twilio redirect failed: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
