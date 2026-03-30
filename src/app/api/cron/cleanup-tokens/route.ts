/**
 * POST /api/cron/cleanup-tokens
 *
 * Scheduled hourly via railway.json.
 * Deletes expired rows from outbound_connect_tokens (TTL=5min, created in D91).
 * Uses a 10-minute window (2x the TTL) to avoid racing with in-flight calls.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()

  const { error, count } = await svc
    .from('outbound_connect_tokens')
    .delete({ count: 'exact' })
    .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  if (error) {
    console.error('[cleanup-tokens] Delete failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  console.log(`[cleanup-tokens] Deleted ${count ?? 0} expired token(s)`)
  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
