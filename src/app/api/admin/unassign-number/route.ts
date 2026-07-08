/**
 * POST /api/admin/unassign-number
 *
 * Releases a Twilio number from a client and returns it to the inventory pool.
 * Thin auth wrapper around releaseClientNumber() in lib/release-number.ts
 * (shared with the Telegram churn-flow confirm).
 *
 * Body: { clientId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { releaseClientNumber } from '@/lib/release-number'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (cu?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const result = await releaseClientNumber(svc, clientId)

  if (!result.ok) {
    const status = result.error === 'Client not found' ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    success: true,
    phone_number: result.phoneNumber,
    returned_to_inventory: result.returnedToInventory,
    note: result.note,
  })
}
