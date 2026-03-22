/**
 * GET /api/public/available-numbers?intakeId={id}
 *
 * Returns inventory numbers available for selection during onboarding ($20 CAD vs $25 fresh).
 * Treats reservations older than 30 minutes as expired (available again).
 * Requires a valid intakeId to prevent unguarded enumeration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { formatPhone } from '@/lib/phone'

export async function GET(req: NextRequest) {
  const svc = createServiceClient()
  const intakeId = req.nextUrl.searchParams.get('intakeId')

  if (!intakeId) {
    return NextResponse.json({ error: 'intakeId required' }, { status: 400 })
  }

  // Validate intake exists
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('id')
    .eq('id', intakeId)
    .maybeSingle()

  if (!intake) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  // Expiry threshold: 30 minutes ago
  const expiryTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: rows, error } = await svc
    .from('number_inventory')
    .select('phone_number, province, area_code, country')
    .or(`status.eq.available,and(status.eq.reserved,reserved_at.lt.${expiryTime})`)
    .order('province', { ascending: true })
    .order('phone_number', { ascending: true })

  if (error) {
    console.error('[available-numbers] Query error:', error)
    return NextResponse.json({ numbers: [] })
  }

  const numbers = (rows ?? []).map((r) => ({
    phone_number: r.phone_number as string,
    display: formatPhone(r.phone_number as string),
    province: r.province as string | null,
    area_code: r.area_code as string | null,
    country: r.country as string,
  }))

  return NextResponse.json({ numbers })
}
