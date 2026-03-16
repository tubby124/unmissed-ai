/**
 * POST /api/admin/test-call
 *
 * Admin-only endpoint that creates a free WebRTC call (no Twilio)
 * with a given prompt. Returns joinUrl for the browser SDK to connect.
 *
 * Body: { prompt: string, voice?: string }
 * Returns: { joinUrl, callId }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { createDemoCall } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { prompt?: string; voice?: string }
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  // ── Create WebRTC call (no Twilio = free) ──────────────────────────────────
  try {
    const { joinUrl, callId } = await createDemoCall({
      systemPrompt: body.prompt,
      voice: body.voice || null,
      maxDuration: '180s',
      timeExceededMessage: "Test call time limit reached — edit the prompt and try again!",
    })

    return NextResponse.json({ joinUrl, callId })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create test call', detail: String(err) },
      { status: 502 },
    )
  }
}
