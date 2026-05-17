/**
 * POST /api/cron/daily-digest-client
 *
 * Scheduled 13:00 UTC daily (7 AM CST / 6 AM MST) via railway.json.
 * Sends each Core+/Pro client a morning email summarizing yesterday's calls.
 *
 * Promised by pricing.ts Core tier: "Daily morning summary of all your calls".
 * Lite tier is intentionally excluded (no daily digest entitlement).
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface ClientRow {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
  agent_name: string | null
  selected_plan: string | null
  email_notifications_enabled: boolean | null
}

interface CallRow {
  call_status: string | null
  duration_seconds: number | null
  ai_summary: string | null
  caller_phone: string | null
  caller_name: string | null
  client_id: string
  started_at: string
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 })
  }

  const svc = createServiceClient()

  // Eligible: active, has email, opted in, on core/pro plan
  const { data: clients, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, contact_email, agent_name, selected_plan, email_notifications_enabled')
    .eq('status', 'active')
    .in('selected_plan', ['core', 'pro'])

  if (clientErr) {
    console.error('[daily-digest-client] Client query failed:', clientErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const eligibleClients = (clients ?? []).filter((c: ClientRow) =>
    c.contact_email && c.email_notifications_enabled !== false
  ) as ClientRow[]

  if (eligibleClients.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // Last 24 hours of calls
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const clientIds = eligibleClients.map((c) => c.id)

  const { data: allCalls } = await svc
    .from('call_logs')
    .select('call_status, duration_seconds, ai_summary, caller_phone, caller_name, client_id, started_at')
    .in('client_id', clientIds)
    .gte('started_at', dayAgo)
    .neq('call_status', 'test')
    .order('started_at', { ascending: false })

  const calls = (allCalls ?? []) as CallRow[]

  // Group by client
  const callsByClient = new Map<string, CallRow[]>()
  for (const c of calls) {
    const arr = callsByClient.get(c.client_id) ?? []
    arr.push(c)
    callsByClient.set(c.client_id, arr)
  }

  let sent = 0
  let skipped = 0
  const details: { slug: string; sent: boolean; count?: number; reason?: string }[] = []

  for (const client of eligibleClients) {
    const clientCalls = callsByClient.get(client.id) ?? []

    if (clientCalls.length === 0) {
      skipped++
      details.push({ slug: client.slug, sent: false, reason: 'no activity' })
      continue
    }

    const total = clientCalls.length
    const hot = clientCalls.filter((c) => c.call_status === 'HOT').length
    const warm = clientCalls.filter((c) => c.call_status === 'WARM').length
    const missed = clientCalls.filter((c) => c.call_status === 'MISSED').length
    const agentName = client.agent_name ?? client.business_name
    const dashboardUrl = `${APP_URL}/dashboard/calls`

    const callRows = clientCalls
      .slice(0, 15)
      .map((c) => {
        const phone = c.caller_phone ?? 'Unknown'
        const name = c.caller_name ?? ''
        const tag = c.call_status ?? '—'
        const tagColor = tag === 'HOT' ? '#ef4444' : tag === 'WARM' ? '#f59e0b' : tag === 'MISSED' ? '#71717a' : '#a1a1aa'
        const summary = (c.ai_summary || '').slice(0, 120)
        return `<tr style="border-bottom:1px solid #27272a">
  <td style="padding:10px 8px;font-size:12px;color:#a1a1aa;white-space:nowrap">${esc(phone)}${name ? `<br><span style="color:#71717a">${esc(name)}</span>` : ''}</td>
  <td style="padding:10px 8px;font-size:12px;color:#e4e4e7">${esc(summary)}</td>
  <td style="padding:10px 8px;text-align:right"><span style="display:inline-block;padding:2px 8px;background:${tagColor};color:#fff;border-radius:4px;font-size:10px;font-weight:600">${esc(tag)}</span></td>
</tr>`
      })
      .join('')

    const subject = `Yesterday: ${total} call${total !== 1 ? 's' : ''}${hot > 0 ? ` · ${hot} hot` : ''}${missed > 0 ? ` · ${missed} missed` : ''}`

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#e4e4e7;background:#09090b">
  <h2 style="margin:0 0 4px;font-size:20px;color:#fafafa">${esc(agentName)}'s Morning Report</h2>
  <p style="margin:0 0 24px;font-size:13px;color:#71717a">What ${esc(agentName)} caught for you in the last 24 hours</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr>
      <td style="padding:16px;background:#18181b;border-radius:12px 0 0 12px;text-align:center;border:1px solid #27272a;border-right:none">
        <div style="font-size:28px;font-weight:700;color:#fafafa">${total}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Calls</div>
      </td>
      <td style="padding:16px;background:#18181b;text-align:center;border:1px solid #27272a;border-left:none;border-right:none">
        <div style="font-size:28px;font-weight:700;color:#ef4444">${hot}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Hot</div>
      </td>
      <td style="padding:16px;background:#18181b;text-align:center;border:1px solid #27272a;border-left:none;border-right:none">
        <div style="font-size:28px;font-weight:700;color:#f59e0b">${warm}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Warm</div>
      </td>
      <td style="padding:16px;background:#18181b;border-radius:0 12px 12px 0;text-align:center;border:1px solid #27272a;border-left:none">
        <div style="font-size:28px;font-weight:700;color:#71717a">${missed}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Missed</div>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;margin-bottom:24px">
    <thead><tr style="background:#0c0c0d">
      <th style="text-align:left;padding:10px 8px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.08em">Caller</th>
      <th style="text-align:left;padding:10px 8px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.08em">Summary</th>
      <th style="text-align:right;padding:10px 8px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.08em">Status</th>
    </tr></thead>
    <tbody>${callRows}</tbody>
  </table>

  <a href="${dashboardUrl}" style="display:block;text-align:center;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px">
    View All Calls →
  </a>
</div>`

    const result = await sendBrandedEmail({
      to: client.contact_email!,
      clientId: client.id,
      clientSlug: client.slug,
      purpose: 'marketing',
      tag: 'daily_digest',
      reason: `Daily morning summary from your ${BRAND_NAME} agent.`,
      subject,
      html,
    })

    if (result.ok) {
      sent++
      details.push({ slug: client.slug, sent: true, count: total })
      console.log(`[daily-digest-client] Sent to ${client.contact_email} for ${client.slug} (${total} calls, id=${result.id})`)
    } else {
      skipped++
      details.push({ slug: client.slug, sent: false, reason: result.error })
      console.error(`[daily-digest-client] Email failed for ${client.slug}: ${result.error}`)
    }
  }

  console.log(`[daily-digest-client] Done: ${sent} sent, ${skipped} skipped`)
  return NextResponse.json({ sent, skipped, details })
}
