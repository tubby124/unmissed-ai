/**
 * Release a client's Twilio number back to the pool.
 *
 * Shared by:
 *   - POST /api/admin/unassign-number (dashboard admin action)
 *   - Telegram churn-flow confirm (rel:<token> tap after a subscription
 *     cancellation prompt)
 *
 * Behavior:
 *   - Inventory number: repoint Twilio VoiceUrl → idle, mark row available
 *   - Fresh purchase (not in inventory): clear the clients reference only
 *     (manual Twilio Console cancel if the number should stop billing)
 *   - Always clears clients.twilio_number
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_URL } from '@/lib/app-url'

export interface ReleaseNumberResult {
  ok: boolean
  error?: string
  phoneNumber?: string
  returnedToInventory?: boolean
  note?: string
}

export async function releaseClientNumber(
  svc: SupabaseClient,
  clientId: string,
): Promise<ReleaseNumberResult> {
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, twilio_number, business_name')
    .eq('id', clientId)
    .single()

  if (!client) {
    return { ok: false, error: 'Client not found' }
  }

  const twilioNumber = client.twilio_number as string | null
  if (!twilioNumber) {
    return { ok: false, error: 'Client has no Twilio number assigned' }
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
      signal:  AbortSignal.timeout(15_000),
    })

    if (!patchRes.ok) {
      const errText = await patchRes.text()
      console.error(`[release-number] Twilio PATCH failed for ${twilioNumber}: ${errText}`)
      // Don't abort — still release in DB (admin can fix VoiceUrl manually)
    } else {
      console.log(`[release-number] Twilio VoiceUrl → idle for ${twilioNumber}`)
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
    console.log(`[release-number] ${twilioNumber} returned to inventory`)
  } else {
    // Fresh number — not in inventory, just clear the DB reference
    console.log(`[release-number] ${twilioNumber} is not in inventory — clearing clients row only`)
  }

  // Clear client's Twilio number
  await svc
    .from('clients')
    .update({ twilio_number: null, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  return {
    ok: true,
    phoneNumber: twilioNumber,
    returnedToInventory,
    note: returnedToInventory
      ? 'Number reconfigured to idle and returned to inventory pool.'
      : 'Number cleared from client (not in inventory — cancel manually in Twilio Console if needed).',
  }
}
