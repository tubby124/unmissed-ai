/**
 * POST /api/admin/test-activate
 *
 * Admin-only endpoint that runs the full activation chain without Stripe.
 * Combines the provisioning from create-public-checkout and activation from
 * webhook/stripe into a single call for testing.
 *
 * Body: { intakeId: string, skipTwilio?: boolean }
 * Returns: { clientId, agentId, twilioNumber, authUserId, prompt, smsTemplate, smsSent, emailSent, telegramLink }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildPromptFromIntake,
  validatePrompt,
  buildSmsTemplate,
  NICHE_CLASSIFICATION_RULES,
} from '@/lib/prompt-builder'
import { createAgent, updateAgent, resolveVoiceId, buildAgentTools } from '@/lib/ultravox'
import { slugify } from '@/lib/intake-transform'
import { PROVINCE_AREA_CODES } from '@/lib/phone'
import { getEffectiveMinuteLimit } from '@/lib/plan-entitlements'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { sendAlert } from '@/lib/telegram'
import { insertPromptVersion } from '@/lib/prompt-version-utils'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME, BRAND_TAGLINE, NOTIFICATIONS_EMAIL } from '@/lib/brand'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { intakeId?: string; skipTwilio?: boolean }
  const intakeId = body.intakeId?.trim()
  const skipTwilio = body.skipTwilio ?? true

  if (!intakeId) return NextResponse.json({ error: 'intakeId required' }, { status: 400 })

  // ── Load intake ────────────────────────────────────────────────────────────
  const { data: intake, error: intakeErr } = await svc
    .from('intake_submissions')
    .select('id, niche, business_name, client_slug, contact_email, intake_json, status, progress_status')
    .eq('id', intakeId)
    .single()

  if (intakeErr || !intake) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  const intakeData = (intake.intake_json as Record<string, unknown>) || {}
  if (!intakeData.niche && intake.niche) intakeData.niche = intake.niche

  const businessName = (intakeData.business_name as string) || intake.business_name || 'test-agent'
  const niche = intake.niche || 'other'
  const clientSlug = intake.client_slug || slugify(businessName)
  const contactEmail = intake.contact_email || null
  const callbackPhone = (intakeData.callback_phone as string) || null

  // ── Fetch knowledge docs ───────────────────────────────────────────────────
  let knowledgeDocs = ''
  const { data: kDocs } = await svc
    .from('client_knowledge_docs')
    .select('content_text')
    .eq('intake_id', intakeId)
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
  }

  // ── Generate prompt ────────────────────────────────────────────────────────
  let prompt: string
  try {
    prompt = buildPromptFromIntake(intakeData, '', knowledgeDocs)
  } catch (err) {
    return NextResponse.json({ error: 'Prompt generation failed', detail: String(err) }, { status: 500 })
  }

  const validation = validatePrompt(prompt)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Prompt failed validation', errors: validation.errors, charCount: validation.charCount },
      { status: 422 },
    )
  }

  // ── Generate SMS template ──────────────────────────────────────────────────
  const smsTemplate = buildSmsTemplate(intakeData)

  // ── Resolve voice: direct voiceId from picker > gender fallback > niche default
  const voiceId = resolveVoiceId(
    intakeData.niche_voiceId as string | null,
    intakeData.niche_voiceGender as string | null,
    niche,
  )

  // ── Look up existing client (needed before agent create/update) ───────────
  const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other
  const timezone = (intakeData.timezone as string) || 'America/Chicago'

  const { data: existingClient } = await svc
    .from('clients')
    .select('id, ultravox_agent_id, twilio_number, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions, selected_plan, niche')
    .eq('slug', clientSlug)
    .maybeSingle()

  // ── Create or update Ultravox agent ───────────────────────────────────────
  // Reuse the existing agent if the client already has one — avoids orphaning old agents.
  let agentId: string
  const existingAgentId = existingClient?.ultravox_agent_id as string | undefined
  try {
    const agentName = clientSlug.slice(0, 64) || 'test-agent'
    if (existingAgentId) {
      // Existing client — pass all flags so updateAgent builds complete tool set
      const knowledgeBackend = (existingClient?.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector' && existingClient) {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', existingClient.id)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: prompt,
        voice: voiceId,
        booking_enabled: existingClient?.booking_enabled ?? false,
        slug: clientSlug,
        forwarding_number: (existingClient?.forwarding_number as string | null) || undefined,
        transfer_conditions: (existingClient?.transfer_conditions as string | null) || undefined,
        sms_enabled: existingClient?.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
        niche: (existingClient?.niche as string | null) || undefined,
      }
      await updateAgent(existingAgentId, agentFlags)
      agentId = existingAgentId

      // Keep clients.tools in sync
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', existingClient!.id)

      console.log(`[test-activate] Ultravox agent updated: ${agentId} for "${businessName}"`)
    } else {
      // New client — minimal tools, slug for coaching
      agentId = await createAgent({ systemPrompt: prompt, name: agentName, voice: voiceId, slug: clientSlug })
      console.log(`[test-activate] Ultravox agent created: ${agentId} for "${businessName}"`)
    }
  } catch (err) {
    return NextResponse.json({ error: 'Ultravox agent creation/update failed', detail: String(err) }, { status: 502 })
  }

  let clientId: string

  if (existingClient) {
    clientId = existingClient.id as string
    await svc
      .from('clients')
      .update({
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        agent_voice_id: voiceId,
        classification_rules: classificationRules,
        sms_template: smsTemplate,
        status: 'active',
        bonus_minutes: 50,
        monthly_minute_limit: getEffectiveMinuteLimit((existingClient?.selected_plan as string | null) ?? null, 'active', niche),
        contact_email: contactEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
    console.log(`[test-activate] Updated existing client ${clientSlug} (${clientId})`)
  } else {
    const { data: newClient, error: insertErr } = await svc
      .from('clients')
      .insert({
        slug: clientSlug,
        business_name: businessName,
        niche,
        status: 'active',
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        agent_voice_id: voiceId,
        classification_rules: classificationRules,
        sms_template: smsTemplate,
        timezone,
        bonus_minutes: 50,
        monthly_minute_limit: getEffectiveMinuteLimit(null, 'active', niche),
        contact_email: contactEmail,
      })
      .select('id')
      .single()

    if (insertErr || !newClient) {
      return NextResponse.json({ error: 'Failed to create client', detail: insertErr?.message }, { status: 500 })
    }
    clientId = newClient.id as string
    console.log(`[test-activate] Created new client ${clientSlug} (${clientId})`)
  }

  // ── Prompt version with audit trail ────────────────────────────────────────
  const { data: latestVersion } = await svc
    .from('prompt_versions')
    .select('char_count')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  await insertPromptVersion(svc, {
    clientId,
    content: prompt,
    changeDescription: `Test-activate (niche: ${niche}, ${validation.charCount} chars)`,
    triggeredByUserId: user.id,
    triggeredByRole: 'admin',
    prevCharCount: latestVersion?.char_count ?? null,
  })

  // ── Optional: Buy Twilio number ────────────────────────────────────────────
  let twilioNumber: string | null = null

  if (!skipTwilio) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      const areaCode = (intakeData.area_code as string) || '587'
      const province = (intakeData.province as string) || null
      const isCanadian = !!(province && province in PROVINCE_AREA_CODES)
      const searchCountry = isCanadian ? 'CA' : 'US'
      const searchBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${searchCountry}/Local.json`

      let availableNumber: string | null = null

      if (isCanadian && province) {
        const areaCodes = PROVINCE_AREA_CODES[province] || []
        for (const code of areaCodes) {
          const res = await fetch(`${searchBase}?AreaCode=${code}&Limit=1`, {
            headers: { Authorization: `Basic ${twilioAuth}` },
          })
          if (res.ok) {
            const data = await res.json() as { available_phone_numbers: { phone_number: string }[] }
            availableNumber = data.available_phone_numbers?.[0]?.phone_number ?? null
            if (availableNumber) break
          }
        }
      }

      if (!availableNumber) {
        const res = await fetch(`${searchBase}?AreaCode=${areaCode}&Limit=1`, {
          headers: { Authorization: `Basic ${twilioAuth}` },
        })
        if (res.ok) {
          const data = await res.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = data.available_phone_numbers?.[0]?.phone_number ?? null
        }
      }

      if (availableNumber) {
        const buyBody = new URLSearchParams({
          PhoneNumber: availableNumber,
          VoiceUrl: `${APP_URL}/api/webhook/${clientSlug}/inbound`,
          VoiceMethod: 'POST',
          VoiceFallbackUrl: `${APP_URL}/api/webhook/${clientSlug}/fallback`,
          VoiceFallbackMethod: 'POST',
        })
        const buyRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
          {
            method: 'POST',
            headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: buyBody.toString(),
          },
        )
        if (buyRes.ok) {
          const buyData = await buyRes.json() as { phone_number: string }
          twilioNumber = buyData.phone_number
          await svc.from('clients').update({ twilio_number: twilioNumber }).eq('id', clientId)
          console.log(`[test-activate] Twilio number purchased: ${twilioNumber}`)
        }
      }
    } catch (err) {
      console.error(`[test-activate] Twilio step failed: ${err}`)
    }
  }

  // Fall back to existing Twilio number from client row (no purchase needed)
  if (!twilioNumber && existingClient?.twilio_number) {
    twilioNumber = existingClient.twilio_number as string
    console.log(`[test-activate] Using existing Twilio number: ${twilioNumber}`)
  }

  // ── Create auth user + link ────────────────────────────────────────────────
  let authUserId: string | null = null

  if (contactEmail) {
    const { data: newUser, error: createErr } = await svc.auth.admin.createUser({
      email: contactEmail,
      email_confirm: true,
    })

    if (createErr) {
      // User may already exist — use higher page size to find them
      console.warn(`[test-activate] createUser failed for ${contactEmail}: ${createErr.message} — attempting lookup`)
      const { data: existingUsers } = await svc.auth.admin.listUsers({ perPage: 1000 })
      const found = existingUsers?.users?.find((u) => u.email === contactEmail)
      if (found) {
        authUserId = found.id
        console.log(`[test-activate] Found existing auth user ${authUserId} for ${contactEmail}`)
      } else {
        console.error(`[test-activate] Could not resolve auth user for ${contactEmail}: ${createErr.message}`)
      }
    } else if (newUser?.user) {
      authUserId = newUser.user.id
    }

    if (authUserId) {
      await svc
        .from('client_users')
        .upsert({ user_id: authUserId, client_id: clientId, role: 'owner' }, { onConflict: 'user_id,client_id' })

      await svc.from('clients').update({ supabase_user_id: authUserId }).eq('id', clientId)
    }
  }

  // ── Generate setup URL from recovery link (before SMS) ──────────────────────
  let setupUrl = `${APP_URL}/login`
  if (authUserId && contactEmail) {
    try {
      const { data: linkData } = await svc.auth.admin.generateLink({ type: 'recovery', email: contactEmail })
      const actionLink = linkData?.properties?.action_link ?? ''
      if (actionLink) {
        const parsed = new URL(actionLink)
        const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
        if (tokenHash) setupUrl = `${APP_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
      }
    } catch { /* use fallback login URL */ }
  }

  // ── Mark intake ────────────────────────────────────────────────────────────
  await svc
    .from('intake_submissions')
    .update({ status: 'provisioned', progress_status: 'activated', client_id: clientId })
    .eq('id', intakeId)

  // ── Generate Telegram token ────────────────────────────────────────────────
  const telegramRegToken = randomUUID()
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'
  await svc.from('clients').update({ telegram_registration_token: telegramRegToken }).eq('id', clientId)

  const telegramLink = `https://t.me/${botUsername}?start=${telegramRegToken}`

  // ── Step 1.5: Onboarding SMS (non-blocking) ─────────────────────────────────
  let smsSent = false
  let smsSkipReason: string | null = null

  if (twilioNumber && callbackPhone) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
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
        },
      )
      if (smsRes.ok) {
        smsSent = true
        console.log(`[test-activate] SMS sent to ${callbackPhone} from ${twilioNumber}`)
      } else {
        smsSkipReason = `Twilio error: ${(await smsRes.text()).slice(0, 200)}`
        console.error(`[test-activate] SMS failed: ${smsSkipReason}`)
      }
    } catch (err) {
      smsSkipReason = `threw: ${err}`
      console.error(`[test-activate] SMS threw: ${err}`)
    }
  } else {
    smsSkipReason = !twilioNumber ? 'no Twilio number' : 'no callbackPhone in intake'
  }

  // ── Step 5: Welcome email via Resend (non-blocking) ──────────────────────────
  let emailSent = false
  let emailSkipReason: string | null = null

  if (contactEmail && authUserId) {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const { data: linkData } = await svc.auth.admin.generateLink({ type: 'recovery', email: contactEmail })
        const actionLink = linkData?.properties?.action_link ?? ''
        let setupUrl = `${APP_URL}/dashboard`
        if (actionLink) {
          try {
            const parsed = new URL(actionLink)
            const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
            if (tokenHash) setupUrl = `${APP_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
          } catch { setupUrl = `${APP_URL}/login` }
        }
        const resend = new Resend(resendKey)
        const fromAddress = process.env.RESEND_FROM_EMAIL ?? NOTIFICATIONS_EMAIL
        await resend.emails.send({
          from: fromAddress,
          to: contactEmail,
          subject: `${businessName} — your AI agent is live${twilioNumber ? ` (${twilioNumber})` : ''}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:4px">Welcome to ${BRAND_NAME}</h2>
  <p style="color:#555;margin-top:0">Your AI receptionist is now live.</p>
  ${twilioNumber ? `<p><strong>Your AI phone number:</strong> ${twilioNumber}</p>` : ''}
  <p><strong>Set up your dashboard password</strong></p>
  <a href="${setupUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:8px">Create my password &rarr;</a>
  <p style="font-size:12px;color:#888;margin-top:4px">This link expires in 24 hours.</p>
  ${telegramLink ? `<p><strong>Connect Telegram:</strong><br><a href="${telegramLink}">${telegramLink}</a></p>` : ''}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#888">${BRAND_NAME} — ${BRAND_TAGLINE}</p>
</div>`,
        })
        emailSent = true
        console.log(`[test-activate] Welcome email sent to ${contactEmail}`)
      } catch (err) {
        emailSkipReason = String(err)
        console.error(`[test-activate] Email failed: ${err}`)
      }
    } else {
      emailSkipReason = 'RESEND_API_KEY not set'
    }
  } else {
    emailSkipReason = !contactEmail ? 'no contact email' : 'no auth user resolved'
  }

  // ── Step 7: Telegram admin alert ─────────────────────────────────────────────
  try {
    const { data: adminClient } = await svc
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()
    if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
      await sendAlert(
        adminClient.telegram_bot_token as string,
        adminClient.telegram_chat_id as string,
        `🧪 TEST ACTIVATE: <b>${businessName}</b> | ${niche}\nSMS: ${smsSent ? 'sent' : smsSkipReason}\nEmail: ${emailSent ? 'sent' : emailSkipReason}\nTwilio: ${twilioNumber ?? 'none'}`,
      )
    }
  } catch { /* non-blocking */ }

  // ── Step 8: Write activation_log JSONB ───────────────────────────────────────
  try {
    await svc
      .from('clients')
      .update({
        activation_log: {
          tested_at: new Date().toISOString(),
          twilio_number: twilioNumber ?? 'skipped',
          sms_sent: smsSent,
          sms_skip_reason: smsSent ? null : smsSkipReason,
          email_sent: emailSent,
          email_skip_reason: emailSent ? null : emailSkipReason,
          intake_id: intakeId,
          source: 'test-activate',
        },
      })
      .eq('id', clientId)
    console.log(`[test-activate] activation_log written for ${clientSlug}`)
  } catch (err) {
    console.error(`[test-activate] activation_log write failed: ${err}`)
  }

  console.log(`[test-activate] Done — intake ${intakeId} → client ${clientSlug} (${clientId}) → agent ${agentId}`)

  return NextResponse.json({
    clientId,
    agentId,
    clientSlug,
    twilioNumber,
    authUserId,
    prompt,
    promptCharCount: validation.charCount,
    smsTemplate,
    smsSent,
    emailSent,
    telegramLink,
  })
}
