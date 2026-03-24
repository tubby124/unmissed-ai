/**
 * ensureTwilioProvisioned — Idempotent Twilio number provisioner.
 *
 * Extracted from activateClient() Step 1 so it can be called from:
 *   - activateClient() (stripe + trial_convert modes) — unchanged behaviour
 *   - Stripe upgrade webhook (trial → paid via dashboard billing tab)
 *
 * Idempotency: reads clients.twilio_number before doing anything.
 * Returns immediately if the number is already set.
 *
 * Handles both paths:
 *   - reservedNumber supplied → reconfigure inventory number webhooks
 *   - reservedNumber null/undefined → search + buy a fresh number
 *
 * Writes clients.twilio_number + setup_complete=false on success.
 * The caller is responsible for sending Telegram alerts using notifyMsg.
 */

import { PROVINCE_AREA_CODES } from '@/lib/phone'
import { APP_URL } from '@/lib/app-url'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivationStepName } from '@/lib/provisioning-guards'

export interface TwilioProvisionResult {
  twilioNumber: string | null
  ok: boolean
  /** true when twilio_number was already set — no Twilio API calls made */
  skipped: boolean
  skipReason?: string
  /** 'twilio_assign' for inventory path, 'twilio_purchase' for fresh buy */
  stepName: Extract<ActivationStepName, 'twilio_assign' | 'twilio_purchase'>
  error?: string
  /** Ready-to-send Telegram message for the caller to forward to admin */
  notifyMsg: string
}

export async function ensureTwilioProvisioned(
  svc: SupabaseClient,
  opts: {
    clientId: string
    clientSlug: string
    /** Inventory number to reconfigure instead of buying fresh */
    reservedNumber?: string | null
    /** Used in Telegram messages — falls back to clientSlug */
    businessName?: string
  },
): Promise<TwilioProvisionResult> {
  const {
    clientId,
    clientSlug,
    reservedNumber = null,
    businessName = clientSlug,
  } = opts

  // ── Idempotency: skip if already provisioned ───────────────────────────────
  const { data: existingClient } = await svc
    .from('clients')
    .select('twilio_number')
    .eq('id', clientId)
    .single()

  if (existingClient?.twilio_number) {
    const num = existingClient.twilio_number as string
    console.log(`[ensureTwilioProvisioned] Already provisioned: ${num} for slug=${clientSlug}`)
    return {
      twilioNumber: num,
      ok: true,
      skipped: true,
      skipReason: 'already provisioned',
      stepName: 'twilio_purchase',
      notifyMsg: `📞 Twilio already provisioned: <b>${num}</b> for ${businessName}`,
    }
  }

  // ── Fetch province/area_code from linked intake ────────────────────────────
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const intakeJson = (intake?.intake_json as Record<string, unknown> | null) ?? {}
  const areaCode = (intakeJson.area_code as string | null) ?? null
  const province = (intakeJson.province as string | null)
    || (intakeJson.state as string | null)
    || null

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const voiceUrl = `${APP_URL}/api/webhook/${clientSlug}/inbound`
  const fallbackUrl = `${APP_URL}/api/webhook/${clientSlug}/fallback`
  const smsUrl = `${APP_URL}/api/webhook/${clientSlug}/sms-inbound`

  let twilioNumber: string | null = null

  // ── Inventory path: reconfigure existing number's webhooks ──────────────────
  if (reservedNumber) {
    try {
      const { data: invRow } = await svc
        .from('number_inventory')
        .select('twilio_sid')
        .eq('phone_number', reservedNumber)
        .single()

      if (!invRow) {
        console.error(`[ensureTwilioProvisioned] Inventory number ${reservedNumber} not found in DB for slug=${clientSlug}`)
        // Still assign — client paid. Return success with a warning in the message.
        twilioNumber = reservedNumber
      } else {
        const patchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
        const patchBody = new URLSearchParams({
          VoiceUrl: voiceUrl,
          VoiceMethod: 'POST',
          VoiceFallbackUrl: fallbackUrl,
          VoiceFallbackMethod: 'POST',
          SmsUrl: smsUrl,
          SmsMethod: 'POST',
        })
        const patchRes = await fetch(patchUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: patchBody.toString(),
        })
        if (patchRes.ok) {
          console.log(`[ensureTwilioProvisioned] Inventory number ${reservedNumber} reconfigured for slug=${clientSlug}`)
          twilioNumber = reservedNumber
        } else {
          const errText = await patchRes.text()
          console.error(`[ensureTwilioProvisioned] Twilio PATCH failed for ${reservedNumber}: ${errText}`)
          // Still assign — client paid, VoiceUrl can be fixed manually
          twilioNumber = reservedNumber
        }
      }

      // Mark number as assigned regardless of PATCH result
      await svc
        .from('number_inventory')
        .update({
          status: 'assigned',
          assigned_client_id: clientId,
          reserved_intake_id: null,
          reserved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('phone_number', reservedNumber)
    } catch (err) {
      console.error(`[ensureTwilioProvisioned] Inventory path threw for ${reservedNumber}: ${err}`)
      // Still assign — client paid
      twilioNumber = reservedNumber
    }

    if (twilioNumber) {
      await svc
        .from('clients')
        .update({ twilio_number: twilioNumber, setup_complete: false })
        .eq('id', clientId)
    }

    return {
      twilioNumber,
      ok: true,
      skipped: false,
      stepName: 'twilio_assign',
      notifyMsg: `📞 Inventory number configured: <b>${twilioNumber}</b> for ${businessName}`,
    }
  }

  // ── Fresh path: search + buy a new Twilio number ───────────────────────────
  try {
    const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`
    const isCanadian = !!(province && province in PROVINCE_AREA_CODES)
    const searchCountry = isCanadian ? 'CA' : 'US'
    const searchBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${searchCountry}/Local.json`

    let availableNumber: string | null = null

    if (isCanadian && province) {
      const areaCodes = PROVINCE_AREA_CODES[province] || []
      for (const code of areaCodes) {
        const searchRes = await fetch(`${searchBase}?AreaCode=${code}&Limit=1`, {
          headers: { Authorization: `Basic ${twilioAuth}` },
        })
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
          if (availableNumber) {
            console.log(`[ensureTwilioProvisioned] Found CA number with area code ${code}`)
            break
          }
        }
      }
      if (!availableNumber) {
        console.warn(`[ensureTwilioProvisioned] No number found for province=${province}, trying any CA number`)
        const retryRes = await fetch(`${searchBase}?Limit=1`, {
          headers: { Authorization: `Basic ${twilioAuth}` },
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
        }
      }
    } else {
      const searchUrl = areaCode
        ? `${searchBase}?AreaCode=${areaCode}&Limit=1`
        : `${searchBase}?Limit=1`
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Basic ${twilioAuth}` } })
      if (searchRes.ok) {
        const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
        availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
      }
      if (!availableNumber && areaCode) {
        console.warn(`[ensureTwilioProvisioned] Area code ${areaCode} unavailable, searching without area code`)
        const retryRes = await fetch(`${searchBase}?Limit=1`, {
          headers: { Authorization: `Basic ${twilioAuth}` },
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
        }
      }
    }

    if (!availableNumber) {
      console.error(`[ensureTwilioProvisioned] No available Twilio numbers found for slug=${clientSlug}`)
      return {
        twilioNumber: null,
        ok: false,
        skipped: false,
        stepName: 'twilio_purchase',
        error: 'no numbers available',
        notifyMsg: `⚠️ No Twilio numbers available for ${businessName}`,
      }
    }

    const buyBody = new URLSearchParams({
      PhoneNumber: availableNumber,
      VoiceUrl: voiceUrl,
      VoiceMethod: 'POST',
      VoiceFallbackUrl: fallbackUrl,
      VoiceFallbackMethod: 'POST',
      SmsUrl: smsUrl,
      SmsMethod: 'POST',
    })
    const buyRes = await fetch(buyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buyBody.toString(),
    })

    if (!buyRes.ok) {
      const errText = await buyRes.text()
      console.error(`[ensureTwilioProvisioned] Twilio number purchase failed for slug=${clientSlug}: ${errText}`)
      return {
        twilioNumber: null,
        ok: false,
        skipped: false,
        stepName: 'twilio_purchase',
        error: `purchase failed: ${errText.slice(0, 200)}`,
        notifyMsg: `⚠️ Twilio number purchase FAILED for ${businessName}`,
      }
    }

    const buyData = await buyRes.json() as { phone_number: string }
    twilioNumber = buyData.phone_number
    console.log(`[ensureTwilioProvisioned] Twilio number purchased: ${twilioNumber} for slug=${clientSlug}`)
  } catch (err) {
    console.error(`[ensureTwilioProvisioned] Twilio step threw for slug=${clientSlug}: ${err}`)
    return {
      twilioNumber: null,
      ok: false,
      skipped: false,
      stepName: 'twilio_purchase',
      error: String(err).slice(0, 200),
      notifyMsg: `⚠️ Twilio step threw: ${String(err).slice(0, 100)}`,
    }
  }

  // ── Write twilio_number to clients ─────────────────────────────────────────
  await svc
    .from('clients')
    .update({ twilio_number: twilioNumber, setup_complete: false })
    .eq('id', clientId)

  console.log(`[ensureTwilioProvisioned] clients.twilio_number set: ${twilioNumber} for slug=${clientSlug}`)

  return {
    twilioNumber,
    ok: true,
    skipped: false,
    stepName: 'twilio_purchase',
    notifyMsg: `📞 Twilio number purchased: <b>${twilioNumber}</b> for ${businessName}`,
  }
}
