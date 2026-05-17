import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Gmail / Yahoo RFC 8058 one-click unsubscribe endpoint.
// Required by Gmail bulk-sender rules (Feb 2024) for any marketing-shaped email.
// Without List-Unsubscribe + List-Unsubscribe-Post: One-Click headers backed by
// this endpoint, branded emails get filtered to Spam regardless of SPF/DKIM/DMARC.
//
// Gmail sends POST with empty form body; the recipient identity must live in the
// URL query string of the List-Unsubscribe header.

async function unsubscribe(req: Request) {
  const url = new URL(req.url)
  const email = url.searchParams.get('email')?.trim().toLowerCase()
  const slug = url.searchParams.get('slug')?.trim()
  const cid = url.searchParams.get('cid')?.trim()

  if (!email && !cid) {
    return NextResponse.json({ ok: true, status: 'queued' })
  }

  const supabase = createServiceClient()
  let query = supabase
    .from('clients')
    .select('id, slug, contact_email, email_notifications_enabled')

  if (cid) query = query.eq('id', cid)
  else if (email) query = query.eq('contact_email', email)
  if (slug) query = query.eq('slug', slug)

  const { data: rows, error: findErr } = await query.limit(5)
  if (findErr) {
    return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, status: 'queued' })
  }

  const ids = rows.map((r) => r.id)
  const { error: updateErr } = await supabase
    .from('clients')
    .update({ email_notifications_enabled: false })
    .in('id', ids)

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: 'unsubscribed', count: ids.length })
}

export async function POST(req: Request) {
  return unsubscribe(req)
}

export async function GET(req: Request) {
  return unsubscribe(req)
}
