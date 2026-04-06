import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'

export const maxDuration = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Verify shared secret — Ultravox sends this as a static header
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    unit_number,
    tenant_name,
    caller_phone,
    category,
    description,
    urgency_tier,
    preferred_access_window,
    entry_permission,
    call_id,
  } = body as Record<string, unknown>

  // Validate required fields
  if (!unit_number || !tenant_name || !category || !description || !urgency_tier) {
    return NextResponse.json(
      { error: 'unit_number, tenant_name, category, description, and urgency_tier are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Look up client by slug — include notification fields
  const { data: client } = await supabase
    .from('clients')
    .select('id, niche, business_name, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, contact_email, twilio_number')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (client.niche !== 'property_management') {
    return NextResponse.json({ error: 'Not a property management client' }, { status: 403 })
  }

  // Look up call_log_id from ultravox call_id if provided
  let call_log_id: string | null = null
  if (call_id && typeof call_id === 'string') {
    const { data: log } = await supabase
      .from('call_logs')
      .select('id')
      .eq('ultravox_call_id', call_id)
      .eq('client_id', client.id)
      .limit(1)
      .maybeSingle()
    call_log_id = log?.id ?? null
  }

  const { data: inserted, error } = await supabase
    .from('maintenance_requests')
    .insert({
      client_id: client.id,
      unit_number: unit_number as string,
      tenant_name: tenant_name as string,
      caller_phone: (caller_phone as string | undefined) ?? null,
      category: category as string,
      description: description as string,
      urgency_tier: urgency_tier as string,
      preferred_access_window: (preferred_access_window as string | undefined) ?? null,
      entry_permission: (entry_permission as boolean | undefined) ?? null,
      call_log_id,
      created_by: 'voice_agent',
    })
    .select('id, status')
    .single()

  if (error) {
    console.error(`[maintenance-request] Insert failed for slug=${slug}: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Notify PM ──────────────────────────────────────────────────────────────
  // Fire-and-forget: don't block response on notification delivery
  void notifyPm({
    supabase,
    client: client as {
      id: string
      business_name: string | null
      telegram_bot_token: string | null
      telegram_chat_id: string | null
      telegram_chat_id_2: string | null
      contact_email: string | null
    },
    slug,
    call_log_id,
    unit_number: unit_number as string,
    tenant_name: tenant_name as string,
    caller_phone: (caller_phone as string | undefined) ?? null,
    category: category as string,
    description: description as string,
    urgency_tier: urgency_tier as string,
    maintenance_request_id: inserted.id,
  })

  return NextResponse.json({ id: inserted.id, status: inserted.status })
}

// ── Notification helper ───────────────────────────────────────────────────────

interface NotifyPmParams {
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServiceClient>>
  client: {
    id: string
    business_name: string | null
    telegram_bot_token: string | null
    telegram_chat_id: string | null
    telegram_chat_id_2: string | null
    contact_email: string | null
  }
  slug: string
  call_log_id: string | null
  unit_number: string
  tenant_name: string
  caller_phone: string | null
  category: string
  description: string
  urgency_tier: string
  maintenance_request_id: string
}

async function notifyPm(p: NotifyPmParams): Promise<void> {
  const isUrgent = p.urgency_tier === 'urgent'
  const biz = p.client.business_name || p.slug
  const DIVIDER = '━━━━━━━━━━━━━━━━━'

  const fmtPhone = (phone: string) => {
    const d = phone.replace(/\D/g, '')
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    return phone
  }

  const phoneStr = p.caller_phone ? fmtPhone(p.caller_phone) : 'unknown'
  const categoryLabel = p.category.replace(/_/g, ' ')

  // ── Telegram ────────────────────────────────────────────────────────────────
  if (p.client.telegram_bot_token && p.client.telegram_chat_id) {
    const lines: string[] = []

    if (isUrgent) {
      lines.push(`🚨 <b>[P1 URGENT] New maintenance request</b>`)
      lines.push(`⚠️ REQUIRES IMMEDIATE RESPONSE`)
    } else {
      lines.push(`🔧 <b>[Routine] New maintenance request</b>`)
    }

    lines.push(DIVIDER)
    lines.push(`📍 Unit <b>${p.unit_number}</b> — ${p.tenant_name}`)
    lines.push(`🛠 Issue: ${categoryLabel} — ${p.description}`)
    if (p.caller_phone) lines.push(`📞 ${phoneStr}`)
    lines.push(DIVIDER)
    lines.push(`<a href="https://app.unmissed.ai/dashboard/maintenance">View in dashboard →</a>`)

    const message = lines.join('\n')
    const sent = await sendAlert(
      p.client.telegram_bot_token,
      p.client.telegram_chat_id,
      message,
      p.client.telegram_chat_id_2 ?? undefined
    )

    const { error: nlErr } = await p.supabase.from('notification_logs').insert({
      call_id: p.call_log_id,
      client_id: p.client.id,
      channel: 'telegram',
      recipient: p.client.telegram_chat_id,
      content: message.slice(0, 10000),
      status: sent ? 'sent' : 'failed',
      error: sent ? null : 'sendAlert returned false',
    })
    if (nlErr) console.error(`[maintenance-request] notification_logs insert failed (telegram): ${nlErr.message}`)
  }

  // ── Email (urgent only) ─────────────────────────────────────────────────────
  if (isUrgent && p.client.contact_email) {
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (!resendKey) return

      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'notifications@unmissed.ai'

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      const subject = `[P1 URGENT] Unit ${p.unit_number} — ${p.tenant_name} — ${biz}`
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px;color:#dc2626">🚨 P1 Urgent Maintenance Request</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px 0;font-weight:bold;width:140px">Unit</td><td>${escHtml(p.unit_number)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold">Tenant</td><td>${escHtml(p.tenant_name)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold">Category</td><td>${escHtml(categoryLabel)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold">Description</td><td>${escHtml(p.description)}</td></tr>
          ${p.caller_phone ? `<tr><td style="padding:8px 0;font-weight:bold">Phone</td><td>${escHtml(phoneStr)}</td></tr>` : ''}
        </table>
        <p><a href="https://app.unmissed.ai/dashboard/maintenance" style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in Dashboard →</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="font-size:12px;color:#888">unmissed.ai — AI receptionist for property managers</p>
      </div>`

      const emailResult = await resend.emails.send({
        from: fromAddress,
        to: p.client.contact_email,
        subject,
        html,
      })

      const { error: nlErr } = await p.supabase.from('notification_logs').insert({
        call_id: p.call_log_id,
        client_id: p.client.id,
        channel: 'email',
        recipient: p.client.contact_email,
        content: `Subject: ${subject}`,
        status: 'sent',
        external_id: emailResult?.data?.id || null,
      })
      if (nlErr) console.error(`[maintenance-request] notification_logs insert failed (email): ${nlErr.message}`)
    } catch (emailErr) {
      console.error(`[maintenance-request] Email notification failed for slug=${p.slug}:`, emailErr)
      await p.supabase.from('notification_logs').insert({
        call_id: p.call_log_id,
        client_id: p.client.id,
        channel: 'email',
        recipient: p.client.contact_email || 'unknown',
        content: 'maintenance P1 email (failed before send)',
        status: 'failed',
        error: String(emailErr).slice(0, 1000),
      })
    }
  }
}
