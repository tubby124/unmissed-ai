/**
 * POST /api/dashboard/agent-test/end
 *
 * T5: Marks a WebRTC test call as ended in call_logs.
 * On production, Ultravox statusCallback handles this — but on localhost
 * without a tunnel, the callback never fires and calls stay "live" forever.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { callId } = await req.json() as { callId?: string }
  if (!callId) {
    return NextResponse.json({ error: 'callId required' }, { status: 400 })
  }

  const supa = createServiceClient()

  // Only update if the call is still in 'live' status — don't overwrite
  // a proper 'completed' status that arrived via webhook.
  const { error } = await supa
    .from('call_logs')
    .update({
      call_status: 'ended',
      ended_at: new Date().toISOString(),
    })
    .eq('ultravox_call_id', callId)
    .eq('call_status', 'live')

  if (error) {
    console.error('[agent-test/end] Failed to update call_logs:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
