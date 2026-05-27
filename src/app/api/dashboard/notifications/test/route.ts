/**
 * POST /api/dashboard/notifications/test
 *
 * Sends a synthetic owner-alert via the chosen channel to verify the path works
 * end-to-end. Uses the SAME notification functions called at call time, passing
 * { testMode: true } where the function supports it.
 *
 * Body: { channel: 'sms' | 'email' | 'telegram', clientId?: string }
 * Returns: { ok: true } or { ok: false, error: string }
 *
 * Rate-limit: 5 requests per client per hour. Auth via client_users gate
 * (owners can test their own client; admins can target any).
 *
 * Notes on testMode:
 * - sendOwnerSmsAlert accepts { testMode: true } — skips notification_logs writes
 *   and prepends "TEST — " to the body.
 * - sendEmailNotification / sendTelegramNotification do NOT accept testMode today.
 *   They will still WRITE a notification_logs row with call_id=null (column is
 *   nullable). The synthetic ctx.callLogId is null so the FK is null; no real
 *   call_log is referenced.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import {
  sendOwnerSmsAlert,
  sendEmailNotification,
  sendTelegramNotification,
  type NotificationContext,
  type CompletedClient,
  type Classification,
} from '@/lib/completed-notifications'

// Module-level limiter — survives within a single Railway process
const testLimiter = new SlidingWindowRateLimiter(5, 60 * 60_000)

function buildSyntheticClassification(): Classification {
  return {
    status: 'WARM',
    summary: 'This is a synthetic test of your alert channel. No real call took place.',
    serviceType: 'test',
    confidence: 100,
    sentiment: 'neutral',
    key_topics: ['test'],
    next_steps: 'No action required — this is just to confirm alerts are arriving.',
    quality_score: 100,
    caller_data: { caller_name: 'Test Caller', service_requested: 'Channel verification' },
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const channel = body.channel
  if (channel !== 'sms' && channel !== 'email' && channel !== 'telegram') {
    return NextResponse.json({ ok: false, error: 'channel must be sms, email, or telegram' }, { status: 400 })
  }

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  // Resolve target client (non-admin: own client; admin: explicit clientId)
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()
  if (!cu) return NextResponse.json({ ok: false, error: 'No client membership' }, { status: 403 })

  const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined
  const targetClientId = (cu.role === 'admin' && requestedClientId) ? requestedClientId : cu.client_id
  if (!targetClientId) {
    return NextResponse.json({ ok: false, error: 'No target client resolved' }, { status: 400 })
  }

  // Fetch client row using service client (bypasses RLS — owner-test is privileged)
  // Done BEFORE rate-limit record so a bogus clientId can't burn another client's quota.
  const svc = createServiceClient()
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, niche, call_handling_mode, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled, alert_phone, alert_email, alert_email_cc, sms_alerts_enabled, callback_phone')
    .eq('id', targetClientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 })
  }

  // Rate limit (5 per client per hour) — check + record AFTER existence verified
  const rl = testLimiter.check(targetClientId)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Rate limit: try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }
  testLimiter.record(targetClientId)

  const classification = buildSyntheticClassification()
  const syntheticCtx: NotificationContext = {
    supabase: svc,
    client: client as CompletedClient,
    callId: 'test-' + Date.now(),
    callLogId: null,  // null → SMS skips notification_logs writes (via testMode); email/telegram write a row with null call_id
    slug: client.slug as string,
    callerPhone: '+15551234567',
    classification,
    durationSeconds: 0,
    endedAt: new Date().toISOString(),
    ultravoxSummary: null,
    recordingUrl: null,
    metadata: {},
    transcript: [],
    callbackPreference: null,
  }

  try {
    if (channel === 'sms') {
      // testMode → "TEST — " prefix + skip notification_logs
      await sendOwnerSmsAlert(syntheticCtx, { testMode: true })
    } else if (channel === 'email') {
      // No testMode support — will write notification_logs row with call_id=null
      await sendEmailNotification(syntheticCtx)
    } else {
      // telegram — same as email; notification_logs row written with call_id=null
      await sendTelegramNotification(syntheticCtx)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Log full error server-side; return generic message to browser (Twilio/Resend
    // error strings can include phone numbers, account SIDs, and auth details).
    console.error(`[test-alert] channel=${channel} client=${targetClientId}:`, err)
    return NextResponse.json({ ok: false, error: 'Alert send failed — check server logs' }, { status: 500 })
  }
}
