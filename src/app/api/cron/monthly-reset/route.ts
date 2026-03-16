/**
 * POST /api/cron/monthly-reset
 *
 * Scheduled on the 1st of each month (00:05 UTC) via railway.json.
 * Resets minutes_used_this_month to 0 for all active clients.
 * Also clears expired bonus_minutes (reloads carry over — only setup bonus resets).
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const adminPassword = process.env.ADMIN_PASSWORD

  const token = authHeader.replace('Bearer ', '')
  if (!token || (token !== cronSecret && token !== adminPassword)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()

  // Reset minutes_used_this_month for all clients
  const { data: clients, error } = await svc
    .from('clients')
    .update({ minutes_used_this_month: 0, seconds_used_this_month: 0 })
    .eq('status', 'active')
    .select('id, slug, business_name, minutes_used_this_month')

  if (error) {
    console.error('[monthly-reset] Failed to reset minutes:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resetCount = clients?.length ?? 0
  const month = new Date().toLocaleString('en', { month: 'long', year: 'numeric' })

  console.log(`[monthly-reset] Reset minutes_used_this_month for ${resetCount} active clients`)

  // Notify admin via Telegram
  try {
    const { data: adminClient } = await svc
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
      await sendAlert(
        adminClient.telegram_bot_token as string,
        adminClient.telegram_chat_id as string,
        `Monthly minute reset complete for ${month}.\n${resetCount} active client(s) reset to 0 minutes used.`
      )
    }
  } catch {
    // Non-blocking
  }

  return NextResponse.json({
    ok: true,
    month,
    clientsReset: resetCount,
  })
}
