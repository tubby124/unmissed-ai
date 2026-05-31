/**
 * POST /api/admin/hermes/provision-twilio
 *
 * Hermes-callable. Provisions a Twilio number for a client previously created
 * via /api/admin/hermes/concierge-create. Idempotent — returns the existing
 * twilio_number if already provisioned.
 *
 * SCOPE: Twilio only. Does NOT create the Ultravox agent, build the system
 * prompt, or wire tools. Hasan still runs `/onboard-client [slug]` from his
 * Mac to complete the Ultravox-side setup. The Ultravox build requires
 * niche-aware prompt composition which the existing onboard flow handles
 * correctly — duplicating that logic from a stateless HTTP endpoint risks
 * silently-broken half-provisioned clients.
 *
 * Auth: bearer token via HERMES_ADMIN_TOKEN.
 *
 * Body:
 *   slug         string  required — clients.slug
 *   province     string  optional — 'AB', 'SK', 'BC', etc. Defaults to 'AB'
 *   area_code    string  optional — '403', '587', '306', etc. Defaults derived from province
 *
 * Returns: { ok, slug, twilio_number, skipped, next_steps }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureTwilioProvisioned } from '@/lib/ensure-twilio-provisioned'
import { sendAlert } from '@/lib/telegram'
import { notifySystemFailure } from '@/lib/admin-alerts'

export async function POST(req: NextRequest) {
  const expected = process.env.HERMES_ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'HERMES_ADMIN_TOKEN not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (presented !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    slug?: string
    province?: string
    area_code?: string
  }
  if (!body.slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  const province = (body.province ?? 'AB').toUpperCase()
  const areaCode = body.area_code ?? null

  const supa = createServiceClient()
  const { data: cl } = await supa
    .from('clients')
    .select('id, slug, business_name, twilio_number')
    .eq('slug', body.slug)
    .maybeSingle()

  if (!cl) {
    return NextResponse.json({ error: `slug "${body.slug}" not found` }, { status: 404 })
  }

  if (cl.twilio_number) {
    return NextResponse.json({
      ok: true,
      slug: cl.slug,
      twilio_number: cl.twilio_number,
      skipped: true,
      skip_reason: 'already provisioned',
      next_steps: [`Run /onboard-client ${cl.slug} from Hasan's Mac to complete Ultravox agent setup`],
    })
  }

  // Ensure an intake_submissions row exists with the province / area_code that
  // ensureTwilioProvisioned will read. If one already exists (e.g. created by
  // the onboarding flow), don't clobber it.
  const { data: existingIntake } = await supa
    .from('intake_submissions')
    .select('id, intake_json')
    .eq('client_id', cl.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existingIntake) {
    const { error: intakeErr } = await supa.from('intake_submissions').insert({
      client_id: cl.id,
      client_slug: cl.slug,
      intake_json: {
        business_name: cl.business_name,
        province,
        area_code: areaCode,
        source: 'hermes_concierge_provision',
      },
    })
    if (intakeErr) {
      console.error(`[hermes/provision-twilio] intake insert failed for ${cl.slug}:`, intakeErr)
    }
  }

  const result = await ensureTwilioProvisioned(supa, {
    clientId: cl.id as string,
    clientSlug: cl.slug as string,
    businessName: cl.business_name as string,
  })

  if (!result.ok) {
    await notifySystemFailure(
      `Hermes Twilio provisioning failed for ${cl.slug}`,
      result.error ?? 'unknown',
      supa,
      cl.id as string,
    )
    return NextResponse.json(
      { ok: false, error: result.error ?? 'twilio provisioning failed' },
      { status: 500 }
    )
  }

  // Telegram admin
  try {
    const { data: adminCl } = await supa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()
    if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
      await sendAlert(
        adminCl.telegram_bot_token as string,
        adminCl.telegram_chat_id as string,
        `${result.notifyMsg}\n\nNext: run <code>/onboard-client ${cl.slug}</code> on the Mac to finish Ultravox setup.`
      )
      await supa.from('notification_logs').insert({
        client_id: cl.id,
        channel: 'telegram',
        recipient: adminCl.telegram_chat_id,
        content: `Twilio provisioned for ${cl.slug}: ${result.twilioNumber}`,
        status: 'sent',
      })
    }
  } catch (tgErr) {
    console.error('[hermes/provision-twilio] Telegram alert failed:', tgErr)
  }

  return NextResponse.json({
    ok: true,
    slug: cl.slug,
    twilio_number: result.twilioNumber,
    skipped: result.skipped,
    next_steps: [
      `Twilio number ${result.twilioNumber} assigned to ${cl.business_name}`,
      `Run /onboard-client ${cl.slug} from Hasan's Mac to create the Ultravox agent + initial prompt`,
      'Hasan will send the forwarding instructions to the customer after the agent is built',
    ],
  })
}
