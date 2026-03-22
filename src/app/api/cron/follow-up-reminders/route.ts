/**
 * POST /api/cron/follow-up-reminders
 *
 * Runs every 30 minutes. Finds HOT/WARM leads that are 2+ hours old
 * without a follow-up reminder sent, and nudges the business owner
 * via Telegram.
 *
 * Auth: Bearer CRON_SECRET only (no ADMIN_PASSWORD fallback — S13a).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { getSignedRecordingUrl } from '@/lib/recording-url'

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  const rm = mins % 60
  return rm > 0 ? `${hrs}h ${rm}m ago` : `${hrs}h ago`
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // Find HOT/WARM calls from 2–24 hours ago that haven't been reminded yet
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: unreminded, error } = await supabase
    .from('call_logs')
    .select(`
      id, ultravox_call_id, caller_phone, caller_name, call_status,
      ai_summary, started_at, duration_seconds, recording_url,
      client_id
    `)
    .in('call_status', ['HOT', 'WARM'])
    .is('followup_reminded_at', null)
    .lt('started_at', twoHoursAgo)
    .gt('started_at', twentyFourHoursAgo)
    .order('started_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[follow-up-reminders] Query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!unreminded?.length) {
    console.log('[follow-up-reminders] No pending reminders')
    return NextResponse.json({ reminded: 0 })
  }

  console.log(`[follow-up-reminders] Found ${unreminded.length} leads needing follow-up`)

  // Group by client_id for batch processing
  const byClient = new Map<string, typeof unreminded>()
  for (const call of unreminded) {
    if (!call.client_id) continue
    const group = byClient.get(call.client_id) || []
    group.push(call)
    byClient.set(call.client_id, group)
  }

  let totalReminded = 0

  for (const [clientId, calls] of byClient) {
    // Fetch client Telegram config
    const { data: client } = await supabase
      .from('clients')
      .select('slug, business_name, telegram_bot_token, telegram_chat_id, telegram_chat_id_2')
      .eq('id', clientId)
      .single()

    if (!client?.telegram_bot_token || !client?.telegram_chat_id) {
      console.warn(`[follow-up-reminders] Skipping client ${clientId} — no Telegram config`)
      continue
    }

    // Build a single reminder message for all pending leads
    const lines = [
      `⏰ <b>FOLLOW-UP REMINDER</b> — ${client.business_name || client.slug}`,
      ``,
      `${calls.length} lead${calls.length > 1 ? 's' : ''} waiting for callback:`,
      ``,
    ]

    for (const call of calls) {
      const name = call.caller_name || 'Unknown'
      const phone = formatPhone(call.caller_phone || 'unknown')
      const ago = timeAgo(call.started_at)
      const emoji = call.call_status === 'HOT' ? '🔥' : '🌤'
      const summary = call.ai_summary ? ` — ${call.ai_summary.slice(0, 80)}` : ''

      lines.push(`${emoji} <b>${call.call_status}</b> · ${name} · ${phone}`)
      lines.push(`   ${ago}${summary}`)
      // S13-REC1: generate signed URL from stored path (private bucket)
      if (call.recording_url) {
        const signedUrl = await getSignedRecordingUrl(call.recording_url)
        if (signedUrl) {
          lines.push(`   🎧 <a href="${signedUrl}">Listen</a>`)
        }
      }
      lines.push(``)
    }

    lines.push(`💡 Call them back — leads go cold fast!`)

    const sent = await sendAlert(
      client.telegram_bot_token,
      client.telegram_chat_id,
      lines.join('\n'),
      client.telegram_chat_id_2 ?? undefined
    )

    if (sent) {
      // Mark all as reminded
      const ids = calls.map(c => c.id)
      await supabase
        .from('call_logs')
        .update({ followup_reminded_at: new Date().toISOString() })
        .in('id', ids)

      totalReminded += calls.length
      console.log(`[follow-up-reminders] Reminded ${client.slug}: ${calls.length} leads`)
    } else {
      console.error(`[follow-up-reminders] Telegram send failed for ${client.slug}`)
    }
  }

  console.log(`[follow-up-reminders] Done: ${totalReminded} total reminders sent`)
  return NextResponse.json({ reminded: totalReminded })
}
