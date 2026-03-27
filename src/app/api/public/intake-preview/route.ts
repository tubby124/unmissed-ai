/**
 * GET /api/public/intake-preview?intakeId=xxx
 *
 * Public (no auth). Returns a preview summary for the agent being onboarded.
 * Used by /onboard/status to show a "Your Agent Preview" card before payment.
 * The intakeId UUID is the "secret" — possession of it is sufficient authorization.
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
    .select('business_name, niche, intake_json')
    .eq('id', intakeId)
    .single()

  if (error || !intake) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const json = (intake.intake_json as Record<string, unknown>) || {}

  return NextResponse.json({
    businessName: (json.businessName as string) || intake.business_name || '',
    niche: (json.niche as string) || intake.niche || 'other',
    agentName: (json.agentName as string) || '',
    voiceId: ((json.nicheAnswers as Record<string, unknown>)?.voiceId as string) || '',
  })
}
