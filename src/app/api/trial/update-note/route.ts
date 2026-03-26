/**
 * POST /api/trial/update-note
 *
 * Public endpoint — lets trial users inject a quick context note into
 * their agent's live awareness (clients.injected_note).
 *
 * The note surfaces as "RIGHT NOW: [text]" inside buildAgentContext(),
 * so the agent mentions it on the very next call.
 *
 * Rate limited: 10 writes/hr/clientId to prevent abuse.
 * No auth required — clientId UUID is the gating secret.
 * Only works for clients with status in ('active', 'setup').
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const perClientLimiter = new SlidingWindowRateLimiter(10, 60 * 60 * 1000)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = (body.clientId as string)?.trim()
  const note = (body.note as string)?.trim() ?? ''

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  const clientCheck = perClientLimiter.check(clientId)
  if (!clientCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many updates. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(clientCheck.retryAfterMs / 1000)) } }
    )
  }

  if (note.length > 500) {
    return NextResponse.json({ error: 'Note too long (max 500 characters)' }, { status: 400 })
  }

  const supa = createServiceClient()

  // Verify client exists and is in a valid state
  const { data: client } = await supa
    .from('clients')
    .select('id, status')
    .eq('id', clientId)
    .in('status', ['active', 'setup'])
    .limit(1)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const { error } = await supa
    .from('clients')
    .update({ injected_note: note || null })
    .eq('id', clientId)

  if (error) {
    console.error('[trial/update-note] update failed:', error.message)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
