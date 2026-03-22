/**
 * Shared activation chain — used by Stripe webhook, trial provisioning, and trial conversion.
 *
 * Modes:
 *   stripe         — Full activation: Twilio purchase + SMS + auth user + email + Telegram
 *   trial          — No Twilio. Auth user + email + dashboard access. subscription_status='trialing'
 *   trial_convert  — Twilio purchase + SMS + Telegram, but SKIP auth user (already exists from trial)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { sendAlert } from '@/lib/telegram'
import { randomUUID } from 'crypto'
import { PROVINCE_AREA_CODES } from '@/lib/phone'
import { getNicheMinuteLimit } from '@/lib/niche-config'
import { runActivationGuards, hasCriticalFailure, summarizeSteps, type ClientRowForGuard, type StepResult } from '@/lib/provisioning-guards'
import { syncClientTools } from '@/lib/sync-client-tools'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME, BRAND_TAGLINE, NOTIFICATIONS_EMAIL } from '@/lib/brand'

async function notifyAdmin(bot: string | null, chat: string | null, msg: string) {
  if (!bot || !chat) return
  try { await sendAlert(bot, chat, msg) } catch { /* non-blocking */ }
}

export async function activateClient(params: {
  mode: 'stripe' | 'trial' | 'trial_convert'
  intakeId: string
  clientId: string
  clientSlug: string
  reservedNumber?: string | null
  trialDays?: number
  stripeSession?: any // Stripe.Checkout.Session
}): Promise<{ success: boolean; twilioNumber?: string; telegramLink?: string; setupUrl?: string; error?: string }> {
  const adminSupa = createServiceClient()
  const { mode, intakeId, clientId, clientSlug, reservedNumber = null, trialDays = 7, stripeSession } = params
  const logPrefix = `[activate-client][${mode}]`

  console.log(`${logPrefix} Starting activation for slug=${clientSlug} intake=${intakeId}`)

  // ── Fetch client row for business_name + niche + guard fields ───────────────
  const { data: existingClient } = await adminSupa
    .from('clients')
    .select('business_name, niche, status, activation_log, stripe_subscription_id, trial_expires_at, trial_converted')
    .eq('id', clientId)
    .single()

  if (!existingClient) {
    console.error(`${logPrefix} Client not found: id=${clientId}`)
    return { success: false, error: `client not found: ${clientId}` }
  }

  const businessName = existingClient.business_name ?? clientSlug

  // ── Phase 6: Pre-activation guards (idempotency + state transition) ────────
  const guardRow: ClientRowForGuard = {
    status: (existingClient.status as ClientRowForGuard['status']) ?? 'setup',
    activation_log: existingClient.activation_log as Record<string, unknown> | null,
    stripe_subscription_id: existingClient.stripe_subscription_id as string | null,
    trial_expires_at: existingClient.trial_expires_at as string | null,
    trial_converted: existingClient.trial_converted as boolean | null,
  }
  const guardResult = runActivationGuards(guardRow, mode)
  if (!guardResult.allowed) {
    if (guardResult.alreadyActivated) {
      console.log(`${logPrefix} Idempotency guard: slug=${clientSlug} already activated — skipping`)
      return { success: true, twilioNumber: undefined, telegramLink: undefined, setupUrl: undefined }
    }
    console.error(`${logPrefix} Guard blocked activation: ${guardResult.reason}`)
    return { success: false, error: `guard blocked: ${guardResult.reason}` }
  }

  // ── Phase 6: Step result tracking ───────────────────────────────────────────
  const steps: StepResult[] = []

  // ── Fetch admin Telegram config (fetched once, used for step-by-step alerts) ─
  const { data: adminClient } = await adminSupa
    .from('clients')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .single()
  const adminBot = adminClient?.telegram_bot_token as string | null
  const adminChat = adminClient?.telegram_chat_id as string | null

  await notifyAdmin(adminBot, adminChat, `${mode === 'trial' ? '🧪' : '💳'} ${mode === 'trial' ? 'Trial started' : 'Payment received'} — activating <b>${businessName}</b>…`)

  // ── Load intake for contact_email, area_code, callbackPhone ───────────────
  const { data: intake } = await adminSupa
    .from('intake_submissions')
    .select('contact_email, intake_json')
    .eq('id', intakeId)
    .single()

  const contactEmail = intake?.contact_email ?? null
  const intakeJson = (intake?.intake_json as Record<string, unknown> | null) ?? {}
  const areaCode = intakeJson.area_code as string | null
  const callbackPhone = (intakeJson.callback_phone as string | null) || null
  const callerAutoText = intakeJson.callerAutoText !== false  // default true
  const callerAutoTextMessage = (intakeJson.callerAutoTextMessage as string | null) || null
  const ownerName = (intakeJson.ownerName as string | null) || null
  const intakeCity = (intakeJson.city as string | null) || null
  const intakeState = (intakeJson.state as string | null) || null

  const appUrl = APP_URL
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'

  // Generate Telegram registration token upfront (needed in SMS + Step 2)
  const telegramRegToken = randomUUID()
  const telegramLink = `https://t.me/${botUsername}?start=${telegramRegToken}`

  let twilioNumber: string | null = null

  // ── Step 1: Assign Twilio number (skip entirely for trial mode) ─────────────
  if (mode !== 'trial') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const voiceUrl   = `${appUrl}/api/webhook/${clientSlug}/inbound`
    const fallbackUrl = `${appUrl}/api/webhook/${clientSlug}/fallback`
    const smsUrl     = `${appUrl}/api/webhook/${clientSlug}/sms-inbound`

    if (reservedNumber) {
      // ── Inventory path: configure existing number's webhooks ─────────────────
      try {
        const { data: invRow } = await adminSupa
          .from('number_inventory')
          .select('twilio_sid')
          .eq('phone_number', reservedNumber)
          .single()

        if (!invRow) {
          console.error(`${logPrefix} Inventory number ${reservedNumber} not found in DB for slug=${clientSlug}`)
          await notifyAdmin(adminBot, adminChat, `⚠️ Inventory number ${reservedNumber} missing from DB — manual fix needed`)
        } else {
          const patchUrl  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
          const patchBody = new URLSearchParams({
            VoiceUrl:            voiceUrl,
            VoiceMethod:         'POST',
            VoiceFallbackUrl:    fallbackUrl,
            VoiceFallbackMethod: 'POST',
            SmsUrl:              smsUrl,
            SmsMethod:           'POST',
          })
          const patchRes = await fetch(patchUrl, {
            method:  'POST',
            headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    patchBody.toString(),
          })
          if (patchRes.ok) {
            console.log(`${logPrefix} Inventory number ${reservedNumber} reconfigured for slug=${clientSlug}`)
            await notifyAdmin(adminBot, adminChat, `📞 Inventory number configured: <b>${reservedNumber}</b> for ${businessName}`)
          } else {
            const errText = await patchRes.text()
            console.error(`${logPrefix} Twilio PATCH failed for ${reservedNumber}: ${errText}`)
            await notifyAdmin(adminBot, adminChat, `⚠️ Twilio PATCH failed for ${reservedNumber} — fix VoiceUrl manually`)
          }
        }

        // Mark number as assigned regardless of PATCH result (client paid)
        await adminSupa
          .from('number_inventory')
          .update({
            status: 'assigned',
            assigned_client_id: clientId,
            reserved_intake_id: null,
            reserved_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('phone_number', reservedNumber)

        twilioNumber = reservedNumber
        steps.push({ step: 'twilio_assign', ok: true })
      } catch (err) {
        console.error(`${logPrefix} Inventory path threw for ${reservedNumber}: ${err}`)
        await notifyAdmin(adminBot, adminChat, `⚠️ Inventory path threw: ${String(err).slice(0, 100)}`)
        twilioNumber = reservedNumber // still assign — client paid
        steps.push({ step: 'twilio_assign', ok: true }) // number assigned despite PATCH issue
      }
    } else {
      // ── Fresh path: search + buy a new Twilio number ──────────────────────────
      try {
        const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`

        const province = (intakeJson.province as string | null) || null
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
              if (availableNumber) { console.log(`${logPrefix} Found CA number with area code ${code}`); break }
            }
          }
          if (!availableNumber) {
            console.warn(`${logPrefix} No number found for province=${province}, trying any CA number`)
            const retryRes = await fetch(`${searchBase}?Limit=1`, { headers: { Authorization: `Basic ${twilioAuth}` } })
            if (retryRes.ok) {
              const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
              availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
            }
          }
        } else {
          const searchUrl = areaCode ? `${searchBase}?AreaCode=${areaCode}&Limit=1` : `${searchBase}?Limit=1`
          const searchRes = await fetch(searchUrl, { headers: { Authorization: `Basic ${twilioAuth}` } })
          if (searchRes.ok) {
            const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
            availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
          }
          if (!availableNumber && areaCode) {
            console.warn(`${logPrefix} Area code ${areaCode} unavailable, searching without area code`)
            const retryRes = await fetch(`${searchBase}?Limit=1`, { headers: { Authorization: `Basic ${twilioAuth}` } })
            if (retryRes.ok) {
              const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
              availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
            }
          }
        }

        if (availableNumber) {
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
            headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: buyBody.toString(),
          })
          if (buyRes.ok) {
            const buyData = await buyRes.json() as { phone_number: string }
            twilioNumber = buyData.phone_number
            console.log(`${logPrefix} Twilio number purchased: ${twilioNumber} for slug=${clientSlug}`)
            await notifyAdmin(adminBot, adminChat, `📞 Twilio number purchased: <b>${twilioNumber}</b> for ${businessName}`)
            steps.push({ step: 'twilio_purchase', ok: true })
          } else {
            const errText = await buyRes.text()
            console.error(`${logPrefix} Twilio number purchase failed for slug=${clientSlug}: ${errText}`)
            await notifyAdmin(adminBot, adminChat, `⚠️ Twilio number purchase FAILED for ${businessName}`)
            steps.push({ step: 'twilio_purchase', ok: false, error: `purchase failed: ${errText.slice(0, 200)}` })
          }
        } else {
          console.error(`${logPrefix} No available Twilio numbers found for slug=${clientSlug}`)
          await notifyAdmin(adminBot, adminChat, `⚠️ No Twilio numbers available for ${businessName}`)
          steps.push({ step: 'twilio_purchase', ok: false, error: 'no numbers available' })
        }
      } catch (err) {
        console.error(`${logPrefix} Twilio step threw: ${err}`)
        await notifyAdmin(adminBot, adminChat, `⚠️ Twilio step threw: ${String(err).slice(0, 100)}`)
        steps.push({ step: 'twilio_purchase', ok: false, error: String(err).slice(0, 200) })
      }
    }
  } else {
    steps.push({ step: 'twilio_purchase', ok: false, skipped: true, skipReason: 'trial mode' })
  }

  // ── Phase 6: Early exit on critical Twilio failure ─────────────────────────
  if (hasCriticalFailure(steps, mode)) {
    const stepSummary = summarizeSteps(steps)
    console.error(`${logPrefix} Critical failure — Twilio step failed for slug=${clientSlug}`)
    await notifyAdmin(adminBot, adminChat, `❌ Activation ABORTED for ${businessName} — Twilio failure. Manual recovery needed.`)
    // Write partial activation_log so admin knows what happened
    try {
      await adminSupa.from('clients').update({
        activation_log: {
          activated_at: new Date().toISOString(),
          mode,
          aborted: true,
          abort_reason: 'critical_twilio_failure',
          steps: stepSummary,
          intake_id: intakeId,
        },
      }).eq('id', clientId)
    } catch { /* best effort */ }
    return { success: false, error: 'critical failure: Twilio number not acquired' }
  }

  // ── Auth user creation + welcome email (skip for trial_convert — user exists) ─
  let emailActuallySent = false
  let emailFailReason: string | null = null
  let setupUrl = `${appUrl}/login`

  if (mode !== 'trial_convert' && contactEmail) {
    try {
      let resolvedUserId: string | null = null

      const { data: newUser, error: createErr } = await adminSupa.auth.admin.createUser({
        email: contactEmail,
        email_confirm: true,
      })

      if (createErr) {
        console.warn(`${logPrefix} createUser failed for ${contactEmail}: ${createErr.message} — attempting lookup`)
        const { data: existingUsers } = await adminSupa.auth.admin.listUsers({ perPage: 1000 })
        const found = existingUsers?.users?.find((u) => u.email === contactEmail)
        if (found) {
          resolvedUserId = found.id
          console.log(`${logPrefix} Found existing auth user ${resolvedUserId} for ${contactEmail}`)
        } else {
          console.error(`${logPrefix} Could not resolve user for ${contactEmail}`)
          emailFailReason = `createUser failed and lookup found no user: ${createErr.message}`
        }
      } else if (newUser.user) {
        resolvedUserId = newUser.user.id
      }

      if (resolvedUserId) {
        const newUserId = resolvedUserId

        // Link in client_users (upsert to handle existing links)
        const { error: linkErr } = await adminSupa
          .from('client_users')
          .upsert({ user_id: newUserId, client_id: clientId, role: 'owner' }, { onConflict: 'user_id,client_id' })

        if (linkErr) console.error(`${logPrefix} client_users upsert failed: ${linkErr.message}`)

        // Update intake with user ID
        await adminSupa
          .from('intake_submissions')
          .update({ supabase_user_id: newUserId })
          .eq('id', intakeId)

        // Generate recovery link for SMS setup URL
        try {
          const { data: smsLinkData } = await adminSupa.auth.admin.generateLink({
            type: 'recovery',
            email: contactEmail,
          })
          const smsActionLink = smsLinkData?.properties?.action_link ?? ''
          if (smsActionLink) {
            try {
              const parsed = new URL(smsActionLink)
              const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
              if (tokenHash) {
                setupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
              }
            } catch { /* use fallback login URL */ }
          }
        } catch (linkErr2) {
          console.warn(`${logPrefix} SMS recovery link generation failed: ${linkErr2} — using fallback login URL`)
        }

        // Send welcome + password setup email via Resend (if key is configured)
        const resendKey = process.env.RESEND_API_KEY
        if (resendKey) {
          try {
            const { data: linkData } = await adminSupa.auth.admin.generateLink({
              type: 'recovery',
              email: contactEmail,
            })
            const actionLink = linkData?.properties?.action_link ?? ''
            let emailSetupUrl = `${appUrl}/dashboard`
            if (actionLink) {
              try {
                const parsed = new URL(actionLink)
                const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
                if (tokenHash) {
                  emailSetupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
                }
              } catch { emailSetupUrl = `${appUrl}/login` }
            }

            const resend = new Resend(resendKey)
            const fromAddress = process.env.RESEND_FROM_EMAIL ?? NOTIFICATIONS_EMAIL

            const isTrial = mode === 'trial'
            const subjectLine = isTrial
              ? `${businessName} — your AI agent trial is live`
              : `${businessName} — your AI agent is live${twilioNumber ? ` (${twilioNumber})` : ''}`

            await resend.emails.send({
              from: fromAddress,
              to: contactEmail,
              subject: subjectLine,
              html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:4px">Welcome to ${BRAND_NAME}</h2>
  <p style="color:#555;margin-top:0">${isTrial ? 'Your 7-day free trial has started.' : 'Your AI receptionist is now live.'}</p>

  ${twilioNumber ? `<p><strong>Your AI phone number:</strong> ${twilioNumber}</p>` : ''}
  ${isTrial ? '<p>Try your agent from the dashboard using WebRTC demo calls. Upgrade anytime to get a dedicated phone number.</p>' : ''}

  <p><strong>Set up your dashboard password</strong></p>
  <a href="${emailSetupUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:8px">
    Create my password →
  </a>
  <p style="font-size:12px;color:#888;margin-top:4px">This link expires in 24 hours.</p>
  <p style="margin-top:8px;font-size:14px">Or <a href="${appUrl}/login" style="color:#4f46e5">log in directly</a> if you already set a password.</p>

  ${!isTrial && telegramLink ? `<p><strong>Connect Telegram for instant call alerts:</strong><br><a href="${telegramLink}">${telegramLink}</a></p>` : ''}

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#888">${BRAND_NAME} — ${BRAND_TAGLINE}</p>
</div>`,
            })
            emailActuallySent = true
            console.log(`${logPrefix} Welcome email sent via Resend to ${contactEmail}`)
          } catch (emailErr) {
            emailFailReason = String(emailErr)
            console.error(`${logPrefix} Resend email failed for ${contactEmail}: ${emailErr}`)
          }
        } else {
          // Fallback: Supabase default email (no custom branding)
          try {
            await adminSupa.auth.resetPasswordForEmail(contactEmail, {
              redirectTo: `${appUrl}/auth/callback?next=/auth/set-password`,
            })
            emailActuallySent = true
          } catch (emailErr) {
            emailFailReason = String(emailErr)
          }
        }

        console.log(`${logPrefix} Auth user resolved and password email sent to ${contactEmail}`)
        await notifyAdmin(adminBot, adminChat, `👤 Auth account linked, welcome email sent to ${contactEmail}`)
        steps.push({ step: 'auth_user', ok: true })
        steps.push({ step: 'welcome_email', ok: emailActuallySent, error: emailActuallySent ? undefined : emailFailReason ?? 'unknown' })
      } else if (emailFailReason) {
        await notifyAdmin(adminBot, adminChat, `⚠️ Auth/email step: user not resolved for ${contactEmail}`)
        steps.push({ step: 'auth_user', ok: false, error: emailFailReason })
        steps.push({ step: 'welcome_email', ok: false, error: 'user not resolved' })
      }
    } catch (err) {
      emailFailReason = String(err)
      console.error(`${logPrefix} Auth user creation threw: ${err}`)
      await notifyAdmin(adminBot, adminChat, `❌ Auth/email step failed for ${businessName}: ${String(err).slice(0, 100)}`)
      steps.push({ step: 'auth_user', ok: false, error: String(err).slice(0, 200) })
      steps.push({ step: 'welcome_email', ok: false, error: 'auth step failed' })
    }
  } else if (mode === 'trial_convert') {
    steps.push({ step: 'auth_user', ok: false, skipped: true, skipReason: 'trial_convert — user exists' })
    steps.push({ step: 'welcome_email', ok: false, skipped: true, skipReason: 'trial_convert' })
  } else if (!contactEmail) {
    emailFailReason = 'no contact email on intake'
    console.warn(`${logPrefix} No contact_email on intake ${intakeId} — skipping auth user creation`)
    steps.push({ step: 'auth_user', ok: false, skipped: true, skipReason: 'no contact email' })
    steps.push({ step: 'welcome_email', ok: false, skipped: true, skipReason: 'no contact email' })
  }

  // ── Onboarding SMS from new number (skip for trial — no number to send from) ─
  let smsSent = false
  let smsSkipReason: string | null = null

  if (mode !== 'trial' && twilioNumber && callbackPhone) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    try {
      const smsBody = new URLSearchParams({
        From: twilioNumber,
        To: callbackPhone,
        Body: `Your AI agent is live!\n\nSet up your dashboard:\n${setupUrl}\n\nYour AI number: ${twilioNumber}\n\nConnect Telegram for instant call alerts:\n${telegramLink}\n\nReply STOP to opt out.`,
      })
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: smsBody.toString(),
        }
      )
      if (smsRes.ok) {
        smsSent = true
        console.log(`${logPrefix} Onboarding SMS sent to ${callbackPhone} from ${twilioNumber}`)
        await notifyAdmin(adminBot, adminChat, `📤 Onboarding SMS sent to ${callbackPhone}`)
      } else {
        const errText = await smsRes.text()
        smsSkipReason = `Twilio error: ${errText.slice(0, 200)}`
        console.error(`${logPrefix} SMS failed for slug=${clientSlug}: ${smsSkipReason}`)
        await notifyAdmin(adminBot, adminChat, `⚠️ SMS failed: ${smsSkipReason.slice(0, 100)}`)
      }
    } catch (err) {
      smsSkipReason = `threw: ${err}`
      console.error(`${logPrefix} SMS threw: ${err}`)
      steps.push({ step: 'onboarding_sms', ok: false, error: String(err).slice(0, 200) })
    }
    if (smsSent) steps.push({ step: 'onboarding_sms', ok: true })
    else if (!steps.find(s => s.step === 'onboarding_sms')) {
      steps.push({ step: 'onboarding_sms', ok: false, error: smsSkipReason ?? 'unknown' })
    }
  } else if (mode === 'trial') {
    smsSkipReason = 'trial mode — no Twilio number'
    steps.push({ step: 'onboarding_sms', ok: false, skipped: true, skipReason: smsSkipReason })
  } else {
    smsSkipReason = !twilioNumber ? 'no Twilio number purchased' : 'no callbackPhone in intake'
    console.warn(`${logPrefix} SMS skipped for slug=${clientSlug}: ${smsSkipReason}`)
    steps.push({ step: 'onboarding_sms', ok: false, skipped: true, skipReason: smsSkipReason })
  }

  // ── Update clients row ─────────────────────────────────────────────────────
  try {
    const updatePayload: Record<string, unknown> = {
      status: 'active',
      setup_complete: false,
      updated_at: new Date().toISOString(),
      telegram_registration_token: telegramRegToken,
      sms_enabled: callerAutoText,
      bonus_minutes: mode === 'trial' ? 0 : 50,
      monthly_minute_limit: getNicheMinuteLimit((existingClient?.niche as string) || null),
      contact_email: contactEmail,
    }
    if (twilioNumber) updatePayload.twilio_number = twilioNumber
    if (callerAutoTextMessage) updatePayload.sms_template = callerAutoTextMessage

    // Trial-specific fields
    if (mode === 'trial') {
      updatePayload.subscription_status = 'trialing'
      updatePayload.trial_expires_at = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    }

    // Trial conversion fields
    if (mode === 'trial_convert') {
      updatePayload.trial_converted = true
      updatePayload.trial_expires_at = null
    }

    await adminSupa.from('clients').update(updatePayload).eq('id', clientId)
    console.log(`${logPrefix} clients.status → active for slug=${clientSlug}`)
    steps.push({ step: 'client_update', ok: true })

    // S7a: Rebuild clients.tools after capability flag changes (sms_enabled, booking, etc.)
    try {
      await syncClientTools(adminSupa, clientId)
      steps.push({ step: 'tools_sync', ok: true })
    } catch (err) {
      console.error(`${logPrefix} syncClientTools failed: ${err}`)
      steps.push({ step: 'tools_sync', ok: false, error: String(err).slice(0, 200) })
    }
  } catch (err) {
    console.error(`${logPrefix} clients update threw: ${err}`)
    steps.push({ step: 'client_update', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Mark intake as activated ──────────────────────────────────────────────
  try {
    await adminSupa
      .from('intake_submissions')
      .update({ progress_status: 'activated' })
      .eq('id', intakeId)
    steps.push({ step: 'intake_update', ok: true })
  } catch (err) {
    console.error(`${logPrefix} intake progress_status update threw: ${err}`)
    steps.push({ step: 'intake_update', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Link knowledge docs from intake to client ────────────────────────────────
  try {
    await adminSupa
      .from('client_knowledge_docs')
      .update({ client_id: clientId })
      .eq('intake_id', intakeId)
      .is('client_id', null)
    console.log(`${logPrefix} Linked knowledge docs from intake=${intakeId} to client=${clientId}`)
    steps.push({ step: 'knowledge_docs', ok: true })
  } catch (err) {
    console.error(`${logPrefix} knowledge doc linking threw: ${err}`)
    steps.push({ step: 'knowledge_docs', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Persist FAQ pairs to clients.extra_qa ────────────────────────────────────
  try {
    const faqPairsRaw = intakeJson.niche_faq_pairs as string | undefined
    if (faqPairsRaw) {
      const faqPairs = JSON.parse(faqPairsRaw)
      if (Array.isArray(faqPairs) && faqPairs.length > 0) {
        await adminSupa.from('clients').update({ extra_qa: faqPairs }).eq('id', clientId)
        console.log(`${logPrefix} Persisted ${faqPairs.length} FAQ pairs to clients.extra_qa`)
        steps.push({ step: 'faq_persist', ok: true })
      } else {
        steps.push({ step: 'faq_persist', ok: false, skipped: true, skipReason: 'no FAQ pairs' })
      }
    } else {
      steps.push({ step: 'faq_persist', ok: false, skipped: true, skipReason: 'no FAQ data in intake' })
    }
  } catch (err) {
    console.error(`${logPrefix} FAQ pairs persistence threw: ${err}`)
    steps.push({ step: 'faq_persist', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Telegram alert to admin (with client registration link) ─────────────────
  try {
    const { data: adminCl } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
      let msg: string
      if (mode === 'trial') {
        const locationLine = [intakeCity, intakeState].filter(Boolean).join(', ')
        msg = `🧪 <b>${businessName}</b> started a ${trialDays}-day trial\n\n` +
          `👤 ${ownerName || 'no name'}\n` +
          `📧 ${contactEmail || 'no email'}\n` +
          `📞 ${callbackPhone || 'no phone'}\n` +
          (locationLine ? `📍 ${locationLine}\n` : '') +
          `🏷️ ${(existingClient?.niche as string || 'other').replace(/_/g, ' ')}\n\n` +
          `🔗 <b>Dashboard link (send manually if email failed):</b>\n${setupUrl}\n\n` +
          `${emailActuallySent ? '✅ Welcome email sent' : `⚠️ Email not sent: ${emailFailReason}`}`
      } else {
        msg = twilioNumber
          ? `✅ <b>${businessName}</b> activated — ${twilioNumber}\n\n📱 <b>Client Telegram setup link:</b>\n${telegramLink}\n\n${smsSent ? '📤 Onboarding SMS sent to client.' : `⚠️ SMS not sent: ${smsSkipReason}`}\n\n<i>Forward link if SMS didn't reach them.</i>`
          : `✅ <b>${businessName}</b> activated — no number (assign manually)\n\n📱 <b>Client Telegram setup link:</b>\n${telegramLink}`
      }
      if (mode === 'trial_convert') {
        msg = `🔄 <b>${businessName}</b> converted from trial — ${twilioNumber || 'no number'}\n\n📱 <b>Client Telegram setup link:</b>\n${telegramLink}\n\n${smsSent ? '📤 Onboarding SMS sent.' : `⚠️ SMS not sent: ${smsSkipReason}`}`
      }
      await sendAlert(
        adminCl.telegram_bot_token as string,
        adminCl.telegram_chat_id as string,
        msg
      )
      steps.push({ step: 'telegram_alert', ok: true })
    } else {
      steps.push({ step: 'telegram_alert', ok: true, skipped: true, skipReason: 'no admin telegram config' })
    }
  } catch (err) {
    console.error(`${logPrefix} Telegram alert threw: ${err}`)
    steps.push({ step: 'telegram_alert', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Write activation_log audit trail (Phase 6: includes step summary) ─────
  try {
    const stepSummary = summarizeSteps(steps)
    const activationLog = {
      activated_at: new Date().toISOString(),
      mode,
      stripe_session_id: stripeSession?.id ?? null,
      stripe_amount: stripeSession?.amount_total ?? null,
      twilio_number_bought: twilioNumber,
      telegram_link: mode !== 'trial' ? telegramLink : null,
      telegram_token: telegramRegToken,
      contact_email: contactEmail,
      callback_phone: callbackPhone,
      sms_sent: smsSent,
      sms_skip_reason: smsSent ? null : smsSkipReason,
      email_sent: emailActuallySent,
      email_skip_reason: emailActuallySent ? null : (emailFailReason ?? 'unknown'),
      intake_id: intakeId,
      trial_days: mode === 'trial' ? trialDays : null,
      steps: stepSummary, // Phase 6: per-step audit trail
    }
    await adminSupa
      .from('clients')
      .update({ activation_log: activationLog })
      .eq('id', clientId)
    steps.push({ step: 'activation_log', ok: true })
    console.log(`${logPrefix} activation_log written for slug=${clientSlug}`)
  } catch (err) {
    console.error(`${logPrefix} activation_log write threw: ${err}`)
    steps.push({ step: 'activation_log', ok: false, error: String(err).slice(0, 200) })
  }

  // ── Phase 6: Final critical failure check ──────────────────────────────────
  const hadCriticalFailure = hasCriticalFailure(steps, mode)
  if (hadCriticalFailure) {
    console.error(`${logPrefix} Activation completed with critical failures for slug=${clientSlug}`)
    return { success: false, error: 'activation completed with critical step failures', twilioNumber: twilioNumber ?? undefined, telegramLink, setupUrl }
  }

  console.log(`${logPrefix} Activation complete for slug=${clientSlug}`)
  return { success: true, twilioNumber: twilioNumber ?? undefined, telegramLink, setupUrl }
}
