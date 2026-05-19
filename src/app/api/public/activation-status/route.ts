/**
 * GET /api/public/activation-status?intakeId=xxx
 *
 * Public (no auth). Returns activation status for a given intake.
 * Used by the /onboard/status success screen to show the assigned Twilio number.
 *
 * The intakeId UUID is the "secret" — possession of it is sufficient authorization.
 * Returns: { status: 'pending' | 'activated' | 'failed', twilio_number: string | null, business_name: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkPublicRateLimit } from '@/lib/public-rate-limiter'

export async function GET(req: NextRequest) {
  const rl = checkPublicRateLimit(req)
  if (rl) return rl

  const svc = createServiceClient()
  const intakeId = req.nextUrl.searchParams.get('intakeId')

  if (!intakeId) {
    return NextResponse.json({ error: 'intakeId required' }, { status: 400 })
  }

  const { data: intake, error } = await svc
    .from('intake_submissions')
    .select('progress_status, client_id, business_name')
    .eq('id', intakeId)
    .single()

  if (error || !intake) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!intake.client_id) {
    return NextResponse.json({
      status: 'pending',
      twilio_number: null,
      business_name: intake.business_name || null,
    })
  }

  // Fetch the activation state from the clients row. A paid buyer should never
  // sit on a happy success screen if the webhook logged a critical failure.
  const { data: client } = await svc
    .from('clients')
    .select('twilio_number, business_name, activation_log')
    .eq('id', intake.client_id)
    .single()

  const activationLog = (client?.activation_log ?? null) as Record<string, unknown> | null
  const stepFailures = Array.isArray(activationLog?.steps)
    ? activationLog.steps.some((step) => {
        const row = step as Record<string, unknown>
        return row.ok === false && !row.skipped && ['twilio_purchase', 'twilio_inventory', 'ultravox_agent'].includes(String(row.step))
      })
    : false

  if (activationLog?.aborted || stepFailures) {
    return NextResponse.json({
      status: 'failed',
      twilio_number: client?.twilio_number ?? null,
      business_name: client?.business_name || intake.business_name || null,
      message: 'Activation needs manual help. Contact support@endvoicemail.ai and we will finish your setup.',
    })
  }

  if (intake.progress_status !== 'activated' || !client?.twilio_number) {
    return NextResponse.json({
      status: 'pending',
      twilio_number: client?.twilio_number ?? null,
      business_name: client?.business_name || intake.business_name || null,
    })
  }

  return NextResponse.json({
    status: 'activated',
    twilio_number: client?.twilio_number ?? null,
    business_name: client?.business_name || intake.business_name || null,
  })
}
