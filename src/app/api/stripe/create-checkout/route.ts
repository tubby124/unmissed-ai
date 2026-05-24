/**
 * POST /api/stripe/create-checkout
 *
 * Admin only. Legacy setup-fee checkout route.
 *
 * Setup fees are retired. This endpoint is intentionally disabled so an admin
 * cannot accidentally send an obsolete setup-payment link.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Setup-fee checkout is retired. Use public subscription checkout or trial conversion.' },
    { status: 410 }
  )
}
