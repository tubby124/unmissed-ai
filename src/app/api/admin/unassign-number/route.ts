/**
 * POST /api/admin/unassign-number
 *
 * Releases a Twilio number from a client and returns it to the inventory pool.
 * - If the number is in number_inventory: reconfigures Twilio VoiceUrl → idle, marks available
 * - If the number is a fresh purchase (not in inventory): just clears clients.twilio_number
 * - Always clears clients.twilio_number
 *
 * Body: { clientId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  // Fetch client's current Twilio number
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, twilio_number, business_name')
    .eq('id', clientId)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const twilioNumber = client.twilio_number as string | null

  if (!twilioNumber) {
    return NextResponse.json({ error: 'Client has no Twilio number assigned' }, { status: 400 })
  }

  // Check if this number is in inventory
  const { data: invRow } = await svc
    .from('number_inventory')
    .select('id, twilio_sid')
    .eq('phone_number', twilioNumber)
    .maybeSingle()

  let returnedToInventory = false

  if (invRow) {
    // Inventory number — reconfigure VoiceUrl to idle, then mark available
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const patchUrl  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
    const patchBody = new URLSearchParams({
      VoiceUrl:            `${APP_URL}/api/webhook/inventory-idle`,
      VoiceMethod:         'POST',
      VoiceFallbackUrl:    `${APP_URL}/api/webhook/inventory-idle`,
      VoiceFallbackMethod: 'POST',
    })

    const patchRes = await fetch(patchUrl, {
      method:  'POST',
      headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    patchBody.toString(),
    })

    if (!patchRes.ok) {
      const errText = await patchRes.text()
      console.error(`[unassign-number] Twilio PATCH failed for ${twilioNumber}: ${errText}`)
      // Don't abort — still release in DB (admin can fix VoiceUrl manually)
    } else {
      console.log(`[unassign-number] Twilio VoiceUrl → idle for ${twilioNumber}`)
    }

    // Release in inventory DB
    await svc
      .from('number_inventory')
      .update({
        status:              'available',
        assigned_client_id:  null,
        reserved_intake_id:  null,
        reserved_at:         null,
      })
      .eq('id', invRow.id)

    returnedToInventory = true
    console.log(`[unassign-number] ${twilioNumber} returned to inventory`)
  } else {
    // Fresh number — not in inventory, just clear the DB reference
    console.log(`[unassign-number] ${twilioNumber} is not in inventory — clearing clients row only`)
  }

  // Clear client's Twilio number
  await svc
    .from('clients')
    .update({ twilio_number: null, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  return NextResponse.json({
    success: true,
    phone_number: twilioNumber,
    returned_to_inventory: returnedToInventory,
    note: returnedToInventory
      ? 'Number reconfigured to idle and returned to inventory pool.'
      : 'Number cleared from client (not in inventory — cancel manually in Twilio Console if needed).',
  })
}
