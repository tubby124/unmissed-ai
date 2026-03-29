import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildCalendarBookingTools } from '@/lib/ultravox'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

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

  // Parse context passed by the triage agent via transitionToBookingStage params.
  // These are required so the booking stage can proceed without re-asking the caller.
  const body = await req.json().catch(() => ({}))
  const callerPhone = (body.callerPhone as string) || ''
  const callerName  = (body.callerName  as string) || ''
  const serviceType = (body.serviceType as string) || ''

  const supabase = createServiceClient()

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('agent_name, business_name, booking_enabled, selected_plan, subscription_status')
    .eq('slug', slug)
    .single()

  if (!client || clientError) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!client.booking_enabled) {
    return NextResponse.json({ error: 'Booking not enabled for this client' }, { status: 400 })
  }

  // Plan gate (D83): block non-Pro/non-trial clients in case the route is ever hit
  // directly. The tool itself is only registered for qualifying clients, so this is
  // a belt-and-suspenders guard, not a primary enforcement point.
  const isTrial = client.subscription_status === 'trialing'
  const plan = getPlanEntitlements(client.selected_plan)
  if (!isTrial && !plan.bookingEnabled) {
    return NextResponse.json({ error: 'Booking not available on current plan' }, { status: 403 })
  }

  const name = client.agent_name || 'Sam'
  const isFormal = false // agent_tone not yet in DB — default casual

  // Build context lines from triage-passed values. These replace the templateContext
  // injection the triage stage had — the booking stage gets a fresh system prompt so
  // we must re-inject anything the agent needs to know.
  const contextLines = [
    callerPhone ? `CALLER PHONE: ${callerPhone}` : null,
    callerName  ? `CALLER NAME: ${callerName}`   : null,
    serviceType ? `SERVICE REQUESTED: ${serviceType}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `you are ${name}, a booking assistant${client.business_name ? ` for ${client.business_name}` : ''}.
${contextLines ? '\n' + contextLines + '\n' : ''}
you are now in the booking stage. you already have the caller's name and service need from the previous conversation. do not re-introduce yourself or ask for info you already collected.

BOOKING STEPS:
1. call checkCalendarAvailability with the service type and their preferred date/time
2. offer available slots naturally — read up to 3 options back (e.g. "i've got tuesday at 2pm or wednesday at 10am — which works better for you?")
3. once the caller picks a slot, call bookAppointment with their name, phone number (from CALLER PHONE above), service, date, and the exact time from the slot
4. confirm the booking: "perfect — you're all set for [day] at [time]. i'll send a confirmation text shortly."
5. call hangUp after confirming

IF NO AVAILABILITY:
→ "looks like we're pretty booked around that time — let me check a different day" (try adjacent days)
→ if nothing works: "i'll have someone reach out to find a time that works — is the number you're calling from the best one?" then hangUp

RULES:
- use the exact displayTime returned by checkCalendarAvailability — do not reformat it
- use CALLER PHONE shown above for the bookAppointment callerPhone field
- ${isFormal ? 'keep your tone professional and concise' : 'keep it natural — brief, warm, no filler'}
- do not re-ask for the caller\'s name or service type (you have it from the conversation)`

  // Stage response: only hangUp + booking tools (no transitionToBookingStage — prevents loop)
  const calendarTools = buildCalendarBookingTools(slug)
  const selectedTools = [
    { toolName: 'hangUp' },
    ...calendarTools,
  ]

  // Response body must be a subset of the call creation schema only.
  // X-Ultravox-Response-Type: new-stage tells Ultravox to replace the current stage.
  const response = NextResponse.json({ systemPrompt, selectedTools })
  response.headers.set('X-Ultravox-Response-Type', 'new-stage')
  return response
}
