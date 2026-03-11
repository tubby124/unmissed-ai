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
import { createClient } from '@supabase/supabase-js'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
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
