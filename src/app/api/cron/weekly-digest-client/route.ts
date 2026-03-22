/**
 * POST /api/cron/weekly-digest-client
 *
 * Scheduled Sunday 9 AM CST (15:00 UTC) via railway.json.
 * Sends each active client a weekly performance email via Resend.
 *
 * Auth: Bearer CRON_SECRET only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface ClientRow {
  id: string
  slug: string
  business_name: string
  contact_email: string | null
  agent_name: string | null
  weekly_digest_enabled: boolean | null
}

interface CallRow {
  call_status: string | null
  duration_seconds: number | null
  quality_score: number | null
  key_topics: string[] | null
  client_id: string
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

  // Get all active clients with email
  const { data: clients, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, contact_email, agent_name, weekly_digest_enabled')
    .eq('status', 'active')

  if (clientErr) {
    console.error('[weekly-digest] Client query failed:', clientErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const eligibleClients = (clients ?? []).filter((c: ClientRow) =>
    c.contact_email &&
    c.weekly_digest_enabled !== false // default true — only skip if explicitly disabled
  ) as ClientRow[]

  if (eligibleClients.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // Fetch last 7 days of calls for all eligible clients at once
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const clientIds = eligibleClients.map(c => c.id)

  const { data: allCalls } = await svc
    .from('call_logs')
    .select('call_status, duration_seconds, quality_score, key_topics, client_id')
    .in('client_id', clientIds)
    .gte('started_at', weekAgo)
    .neq('call_status', 'test')

  const calls = (allCalls ?? []) as CallRow[]

  // Fetch bookings
  const { data: allBookings } = await svc
    .from('bookings')
    .select('client_id')
    .in('client_id', clientIds)
    .gte('created_at', weekAgo)

  const bookingsByClient = new Map<string, number>()
  for (const b of allBookings ?? []) {
    bookingsByClient.set(b.client_id, (bookingsByClient.get(b.client_id) ?? 0) + 1)
  }

  // Group calls by client
  const callsByClient = new Map<string, CallRow[]>()
  for (const c of calls) {
    const arr = callsByClient.get(c.client_id) ?? []
    arr.push(c)
    callsByClient.set(c.client_id, arr)
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'notifications@unmissed.ai'
  let sent = 0
  let skipped = 0
  const details: { slug: string; sent: boolean; reason?: string }[] = []

  for (const client of eligibleClients) {
    const clientCalls = callsByClient.get(client.id) ?? []
    const bookingCount = bookingsByClient.get(client.id) ?? 0

    // Skip clients with no activity
    if (clientCalls.length === 0 && bookingCount === 0) {
      skipped++
      details.push({ slug: client.slug, sent: false, reason: 'no activity' })
      continue
    }

    // Aggregate
    const totalCalls = clientCalls.length
    const hotLeads = clientCalls.filter(c => c.call_status === 'HOT').length
    const qualities = clientCalls.filter(c => c.quality_score && c.quality_score > 0).map(c => c.quality_score!)
    const avgQuality = qualities.length > 0
      ? (qualities.reduce((a, b) => a + b, 0) / qualities.length).toFixed(1)
      : null

    // Top topics
    const topicMap = new Map<string, number>()
    for (const c of clientCalls) {
      if (c.key_topics) {
        for (const t of c.key_topics) {
          const norm = t.toLowerCase().trim()
          if (norm) topicMap.set(norm, (topicMap.get(norm) ?? 0) + 1)
        }
      }
    }
    const topTopics = Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)

    const agentName = client.agent_name ?? client.business_name
    const dashboardUrl = `${APP_URL}/dashboard`

    // Build email
    const subject = `Your agent's week: ${totalCalls} call${totalCalls !== 1 ? 's' : ''} handled${hotLeads > 0 ? `, ${hotLeads} hot lead${hotLeads !== 1 ? 's' : ''}` : ''}`

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#e4e4e7;background:#09090b">
  <h2 style="margin:0 0 4px;font-size:20px;color:#fafafa">${esc(agentName)}'s Weekly Report</h2>
  <p style="margin:0 0 24px;font-size:13px;color:#71717a">Here's what happened in the last 7 days</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr>
      <td style="padding:16px;background:#18181b;border-radius:12px 0 0 12px;text-align:center;border:1px solid #27272a;border-right:none">
        <div style="font-size:28px;font-weight:700;color:#fafafa">${totalCalls}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Calls</div>
      </td>
      <td style="padding:16px;background:#18181b;text-align:center;border:1px solid #27272a;border-left:none;border-right:none">
        <div style="font-size:28px;font-weight:700;color:#ef4444">${hotLeads}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Hot Leads</div>
      </td>
      <td style="padding:16px;background:#18181b;border-radius:0 12px 12px 0;text-align:center;border:1px solid #27272a;border-left:none">
        <div style="font-size:28px;font-weight:700;color:#fafafa">${bookingCount}</div>
        <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em">Bookings</div>
      </td>
    </tr>
  </table>

  ${avgQuality ? `
  <div style="padding:12px 16px;background:#18181b;border:1px solid #27272a;border-radius:12px;margin-bottom:16px">
    <span style="font-size:12px;color:#71717a">Average Call Quality:</span>
    <span style="font-size:16px;font-weight:600;color:#fafafa;margin-left:8px">${avgQuality}/10</span>
  </div>
  ` : ''}

  ${topTopics.length > 0 ? `
  <div style="padding:12px 16px;background:#18181b;border:1px solid #27272a;border-radius:12px;margin-bottom:24px">
    <div style="font-size:12px;color:#71717a;margin-bottom:8px">Top Topics</div>
    <div>${topTopics.map(t => `<span style="display:inline-block;padding:4px 10px;margin:2px 4px 2px 0;background:#27272a;border-radius:6px;font-size:12px;color:#a1a1aa">${esc(t)}</span>`).join('')}</div>
  </div>
  ` : ''}

  <a href="${dashboardUrl}" style="display:block;text-align:center;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:24px">
    View Full Dashboard
  </a>

  <hr style="border:none;border-top:1px solid #27272a;margin:24px 0">
  <p style="font-size:11px;color:#52525b;text-align:center">
    unmissed.ai — AI receptionist for service businesses<br>
    <a href="${dashboardUrl}/settings" style="color:#52525b">Manage email preferences</a>
  </p>
</div>`

    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: fromAddress,
        to: client.contact_email!,
        subject,
        html,
      })
      sent++
      details.push({ slug: client.slug, sent: true })
      console.log(`[weekly-digest] Sent to ${client.contact_email} for ${client.slug}`)
    } catch (err) {
      skipped++
      details.push({ slug: client.slug, sent: false, reason: String(err) })
      console.error(`[weekly-digest] Email failed for ${client.slug}:`, err)
    }
  }

  console.log(`[weekly-digest] Done: ${sent} sent, ${skipped} skipped`)
  return NextResponse.json({ sent, skipped, details })
}
