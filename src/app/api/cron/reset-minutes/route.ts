/**
 * POST /api/cron/reset-minutes
 *
 * Scheduled at midnight CST on the 1st of every month (0 6 1 * *) via railway.json.
 * Resets minutes_used_this_month to 0 for all active/paused clients.
 * bonus_minutes are NOT reset (purchased add-ons persist).
 * Sends Telegram confirmation to admin.
 *
 * Auth: Bearer CRON_SECRET (or ADMIN_PASSWORD for manual trigger)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const adminPassword = process.env.ADMIN_PASSWORD
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')

  if ((!cronSecret || token !== cronSecret) && (!adminPassword || token !== adminPassword)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()

  // Reset minutes for all active and paused clients
  const { data: resetClients, error } = await svc
    .from('clients')
    .update({
      minutes_used_this_month: 0,
      last_minute_reset_at: now,
    })
    .in('status', ['active', 'paused'])
    .select('id, business_name, slug, minutes_used_this_month')

  if (error) {
    console.error('[reset-minutes] Reset failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const count = resetClients?.length ?? 0
  console.log(`[reset-minutes] Reset ${count} client(s) at ${now}`)

  // Send Telegram confirmation to admin
  const { data: adminClient } = await svc
    .from('clients')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .single()

  if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
    const month = new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    await sendAlert(
      adminClient.telegram_bot_token,
      adminClient.telegram_chat_id,
      `🔄 <b>Monthly Minute Reset</b>\n${month}\n${count} client(s) reset to 0 minutes.`
    )
  }

  return NextResponse.json({ ok: true, clientsReset: count })
}
