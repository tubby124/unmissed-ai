/**
 * POST /api/admin/test-activate
 *
 * Admin-only endpoint that runs the full activation chain without Stripe.
 * Combines the provisioning from create-public-checkout and activation from
 * webhook/stripe into a single call for testing.
 *
 * Body: { intakeId: string, skipTwilio?: boolean }
 * Returns: { clientId, agentId, twilioNumber, authUserId, prompt, smsTemplate }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildPromptFromIntake,
  validatePrompt,
  buildSmsTemplate,
  NICHE_CLASSIFICATION_RULES,
} from '@/lib/prompt-builder'
import { createAgent } from '@/lib/ultravox'
import { slugify } from '@/lib/intake-transform'
import { PROVINCE_AREA_CODES } from '@/lib/phone'
import { randomUUID } from 'crypto'

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
    .single()

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

  // ── Generate prompt ────────────────────────────────────────────────────────
  let prompt: string
  try {
    prompt = buildPromptFromIntake(intakeData)
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

  // ── Create Ultravox agent ──────────────────────────────────────────────────
  let agentId: string
  try {
    const agentName = clientSlug.slice(0, 64) || 'test-agent'
    agentId = await createAgent({ systemPrompt: prompt, name: agentName })
    console.log(`[test-activate] Ultravox agent created: ${agentId} for "${businessName}"`)
  } catch (err) {
    return NextResponse.json({ error: 'Ultravox agent creation failed', detail: String(err) }, { status: 502 })
  }

  // ── Upsert clients row ────────────────────────────────────────────────────
  const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other
  const timezone = (intakeData.timezone as string) || 'America/Chicago'

  const { data: existingClient } = await svc
    .from('clients')
    .select('id, ultravox_agent_id')
    .eq('slug', clientSlug)
    .maybeSingle()

  let clientId: string

  if (existingClient) {
    clientId = existingClient.id as string
    await svc
      .from('clients')
      .update({
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        classification_rules: classificationRules,
        sms_template: smsTemplate,
        status: 'active',
        bonus_minutes: 50,
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
        classification_rules: classificationRules,
        sms_template: smsTemplate,
        timezone,
        bonus_minutes: 50,
      })
      .select('id')
      .single()

    if (insertErr || !newClient) {
      return NextResponse.json({ error: 'Failed to create client', detail: insertErr?.message }, { status: 500 })
    }
    clientId = newClient.id as string
    console.log(`[test-activate] Created new client ${clientSlug} (${clientId})`)
  }

  // ── Prompt version ─────────────────────────────────────────────────────────
  const { data: latestVersion } = await svc
    .from('prompt_versions')
    .select('version')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (latestVersion?.version ?? 0) + 1

  await svc.from('prompt_versions').update({ is_active: false }).eq('client_id', clientId)
  await svc.from('prompt_versions').insert({
    client_id: clientId,
    version: nextVersion,
    content: prompt,
    change_description: `Test-activate (niche: ${niche}, ${validation.charCount} chars)`,
    is_active: true,
  })

  // ── Optional: Buy Twilio number ────────────────────────────────────────────
  let twilioNumber: string | null = null

  if (!skipTwilio) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

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
          VoiceUrl: `${appUrl}/api/webhook/${clientSlug}/inbound`,
          VoiceMethod: 'POST',
          VoiceFallbackUrl: `${appUrl}/api/webhook/${clientSlug}/fallback`,
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

  // ── Create auth user + link ────────────────────────────────────────────────
  let authUserId: string | null = null

  if (contactEmail) {
    const { data: newUser, error: createErr } = await svc.auth.admin.createUser({
      email: contactEmail,
      email_confirm: true,
    })

    if (createErr) {
      // User may already exist
      const { data: existingUsers } = await svc.auth.admin.listUsers()
      const found = existingUsers?.users?.find((u) => u.email === contactEmail)
      if (found) authUserId = found.id
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

  // ── Mark intake ────────────────────────────────────────────────────────────
  await svc
    .from('intake_submissions')
    .update({ status: 'provisioned', progress_status: 'activated', client_id: clientId })
    .eq('id', intakeId)

  // ── Generate Telegram token ────────────────────────────────────────────────
  const telegramRegToken = randomUUID()
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'
  await svc.from('clients').update({ telegram_registration_token: telegramRegToken }).eq('id', clientId)

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
    telegramLink: `https://t.me/${botUsername}?start=${telegramRegToken}`,
  })
}
