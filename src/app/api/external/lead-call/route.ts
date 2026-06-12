/**
 * POST /api/external/lead-call
 *
 * External speed-to-lead trigger (hasansharif.ca Phase 1). An external site
 * POSTs a freshly captured lead (with phone-call consent) and we dial it with
 * the client's outbound qualification agent within ~60 seconds.
 *
 * Design: this route does NOT duplicate the dial pipeline. It inserts a
 * campaign_leads row with scheduled_callback_at = now() and immediately
 * self-triggers /api/cron/scheduled-callbacks (Bearer CRON_SECRET), which is
 * the canonical outbound dial path (AMD, retry rollback, 3-attempt DNC cap,
 * call_logs, Telegram summary). If the inline trigger fails, the 5-minute
 * cron picks the lead up — built-in retry for free.
 *
 * Compliance (CRTC ADAD): callers reach this route only after submitting a
 * form with an explicit automated-call consent line. Outside the allowed
 * calling window (client-local 09:00–20:30 weekdays, 10:00–17:30 weekends)
 * the lead is scheduled for the next window instead of dialed.
 *
 * Auth: x-api-key header must equal EXTERNAL_LEAD_CALL_API_KEY.
 *
 * Body: {
 *   client_slug: string,        // e.g. "hasan-sharif"
 *   phone: string,              // lead's phone, NA formats accepted
 *   name?: string,
 *   notes?: string,             // becomes {{LEAD_NOTES}} in the outbound prompt
 *   external_ref?: string,      // source system lead id (outcome writeback key)
 *   source?: string             // e.g. "hasansharif.ca/get-the-list-calgary"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhoneNA, isValidE164NA } from '@/lib/utils/phone'
import { APP_URL } from '@/lib/app-url'

export const maxDuration = 60

const WINDOWS = {
  weekday: { start: 9 * 60, end: 20 * 60 + 30 }, // 09:00–20:30 local
  weekend: { start: 10 * 60, end: 17 * 60 + 30 }, // 10:00–17:30 local
}

function safeEqual(a: string, b: string): boolean {
  // Hash both sides to fixed length first — constant-time regardless of input length.
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Slugs this shared API key may dial. One key serves trusted first-party sites only. */
function allowedSlugs(): string[] {
  return (process.env.EXTERNAL_LEAD_CALL_ALLOWED_SLUGS ?? 'hasan-sharif')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function localClock(tz: string, d: Date): { minutes: number; isWeekend: boolean } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  const hour = Number(parts.hour) % 24
  const minutes = hour * 60 + Number(parts.minute)
  const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun'
  return { minutes, isWeekend }
}

function withinCallingWindow(tz: string, d: Date): boolean {
  const { minutes, isWeekend } = localClock(tz, d)
  const w = isWeekend ? WINDOWS.weekend : WINDOWS.weekday
  return minutes >= w.start && minutes <= w.end
}

/** Next instant inside the calling window, stepping 15 min, bounded at 7 days. */
function nextCallingWindow(tz: string, from: Date): Date {
  const step = 15 * 60 * 1000
  let t = from.getTime()
  for (let i = 0; i < (7 * 24 * 60) / 15; i++) {
    t += step
    const candidate = new Date(t)
    if (withinCallingWindow(tz, candidate)) return candidate
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000) // defensive fallback
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.EXTERNAL_LEAD_CALL_API_KEY
  const provided = req.headers.get('x-api-key') ?? ''
  if (!apiKey || !provided || !safeEqual(provided, apiKey)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: {
    client_slug?: unknown
    phone?: unknown
    name?: unknown
    notes?: unknown
    external_ref?: unknown
    source?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slug = typeof body.client_slug === 'string' ? body.client_slug.trim() : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : null
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null
  const externalRef = typeof body.external_ref === 'string' ? body.external_ref.trim().slice(0, 100) : null
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 200) : 'external'

  if (!slug) return NextResponse.json({ error: 'client_slug required' }, { status: 400 })
  if (!allowedSlugs().includes(slug)) {
    // The shared key is scoped to specific first-party tenants — anything else is a 404.
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  if (!rawPhone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const phone = isValidE164NA(rawPhone) ? rawPhone : normalizePhoneNA(rawPhone)
  if (!phone || !isValidE164NA(phone)) {
    return NextResponse.json({ error: 'phone is not a valid North American number' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, status, timezone, twilio_number, outbound_prompt, recording_consent_acknowledged_at')
    .eq('slug', slug)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  if (client.status !== 'active') {
    return NextResponse.json({ error: 'Client is not active' }, { status: 409 })
  }
  if (!client.recording_consent_acknowledged_at) {
    return NextResponse.json({ error: 'Recording authorization not acknowledged for this client' }, { status: 409 })
  }
  if (!client.outbound_prompt) {
    return NextResponse.json({ error: 'Outbound agent not configured (clients.outbound_prompt is empty)' }, { status: 409 })
  }
  if (!client.twilio_number && !process.env.TWILIO_FROM_NUMBER) {
    return NextResponse.json({ error: 'No outbound phone number configured' }, { status: 409 })
  }

  // DNC guard: never re-dial a phone this client has marked dnc.
  const { data: dncRow } = await svc
    .from('campaign_leads')
    .select('id')
    .eq('client_id', client.id)
    .eq('phone', phone)
    .eq('status', 'dnc')
    .limit(1)
    .maybeSingle()
  if (dncRow) {
    return NextResponse.json({ ok: true, dnc: true, dialed: false })
  }

  // Dedup: same phone submitted within the last 24h → refresh notes, don't re-dial.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await svc
    .from('campaign_leads')
    .select('id, status, added_at')
    .eq('client_id', client.id)
    .eq('phone', phone)
    .gte('added_at', dayAgo)
    .order('added_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent) {
    if (notes) {
      await svc.from('campaign_leads').update({ notes }).eq('id', recent.id)
    }
    return NextResponse.json({ ok: true, deduped: true, lead_id: recent.id, dialed: false })
  }

  const tz = (client.timezone as string | null) || 'America/Edmonton'
  const now = new Date()
  const inWindow = withinCallingWindow(tz, now)
  const scheduledFor = inWindow ? now : nextCallingWindow(tz, now)

  const { data: inserted, error: insertErr } = await svc
    .from('campaign_leads')
    .insert({
      client_id: client.id,
      phone,
      name,
      notes,
      status: 'new',
      source,
      external_ref: externalRef,
      scheduled_callback_at: scheduledFor.toISOString(),
      added_at: now.toISOString(),
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error(`[external/lead-call] insert failed for ${slug}: ${insertErr?.message}`)
    return NextResponse.json({ error: 'Lead insert failed' }, { status: 500 })
  }

  // In-window: trigger the canonical dial path right now instead of waiting
  // for the next 5-minute cron tick. Failure here is non-fatal — the cron is
  // the safety net.
  let dialedNow = false
  if (inWindow && process.env.CRON_SECRET) {
    try {
      const res = await fetch(`${APP_URL}/api/cron/scheduled-callbacks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) {
        const out = (await res.json().catch(() => ({}))) as { dialed?: number }
        dialedNow = (out.dialed ?? 0) > 0
      } else {
        console.error(`[external/lead-call] inline cron trigger HTTP ${res.status} — cron will retry lead ${inserted.id}`)
      }
    } catch (err) {
      console.error(`[external/lead-call] inline cron trigger failed (cron will retry lead ${inserted.id}):`, err)
    }
  }

  console.log(
    `[external/lead-call] lead ${inserted.id} (${slug}) phone=...${phone.slice(-4)} source=${source} ` +
      `inWindow=${inWindow} dialedNow=${dialedNow} scheduledFor=${scheduledFor.toISOString()}`,
  )

  return NextResponse.json({
    ok: true,
    lead_id: inserted.id,
    dialed: dialedNow,
    scheduled_for: scheduledFor.toISOString(),
    in_calling_window: inWindow,
  })
}
