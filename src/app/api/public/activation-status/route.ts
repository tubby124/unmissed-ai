/**
 * GET /api/public/activation-status?intakeId=xxx
 *
 * Public (no auth). Returns activation status for a given intake.
 * Used by the /onboard/status success screen to show the assigned Twilio number.
 *
 * The intakeId UUID is the "secret" — possession of it is sufficient authorization.
 * Returns: { status: 'pending' | 'activated', twilio_number: string | null, business_name: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
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

  // If not yet activated, return pending
  if (intake.progress_status !== 'activated' || !intake.client_id) {
    return NextResponse.json({
      status: 'pending',
      twilio_number: null,
      business_name: intake.business_name || null,
    })
  }

  // Fetch the Twilio number from the clients row
  const { data: client } = await svc
    .from('clients')
    .select('twilio_number, business_name')
    .eq('id', intake.client_id)
    .single()

  return NextResponse.json({
    status: 'activated',
    twilio_number: client?.twilio_number ?? null,
    business_name: client?.business_name || intake.business_name || null,
  })
}
