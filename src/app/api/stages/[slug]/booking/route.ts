import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildCalendarBookingTools } from '@/lib/ultravox'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const toolSecret = process.env.WEBHOOK_SIGNING_SECRET
  const providedSecret = req.headers.get('X-Tool-Secret')
  if (toolSecret && providedSecret !== toolSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('agent_name, business_name, agent_tone, booking_enabled')
    .eq('slug', slug)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!client.booking_enabled) {
    return NextResponse.json({ error: 'Booking not enabled for this client' }, { status: 400 })
  }

  const name = client.agent_name || 'Sam'
  const tone = client.agent_tone || 'casual'
  const isFormal = tone === 'formal' || tone === 'professional'

  const systemPrompt = `you are ${name}, a booking assistant${client.business_name ? ` for ${client.business_name}` : ''}.

you are now in the booking stage. you already have the caller's name and service need from the previous conversation. do not re-introduce yourself or ask for info you already collected.

BOOKING STEPS:
1. call checkCalendarAvailability with the service type and their preferred date/time
2. offer available slots naturally — read up to 3 options back (e.g. "i've got tuesday at 2pm or wednesday at 10am — which works better for you?")
3. once the caller picks a slot, call bookAppointment with their name, phone number (from CALLER PHONE), service, date, and the exact time from the slot
4. confirm the booking: "perfect — you're all set for [day] at [time]. i'll send a confirmation text shortly."
5. call hangUp after confirming

IF NO AVAILABILITY:
→ "looks like we're pretty booked around that time — let me check a different day" (try adjacent days)
→ if nothing works: "i'll have someone reach out to find a time that works — is the number you're calling from the best one?" then hangUp

RULES:
- use the exact displayTime returned by checkCalendarAvailability — do not reformat it
- always include callerPhone from CALLER PHONE in the bookAppointment call
- ${isFormal ? 'keep your tone professional and concise' : 'keep it natural — brief, warm, no filler'}
- do not re-ask for the caller\'s name or service type (you have it from the conversation)`

  // Stage response: only hangUp + booking tools (no transitionToBookingStage — prevents loop)
  const calendarTools = buildCalendarBookingTools(slug)
  const selectedTools = [
    { toolName: 'hangUp' },
    ...calendarTools,
  ]

  const response = NextResponse.json({
    systemPrompt,
    selectedTools,
    toolResultText: 'Booking stage active. Check availability and book the appointment.',
  })
  response.headers.set('X-Ultravox-Response-Type', 'new-stage')
  return response
}
