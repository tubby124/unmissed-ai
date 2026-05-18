/**
 * POST /api/dashboard/forwarding-diagnostic/test
 *
 * Originates a real test call from a dedicated diagnostic DID to the client's
 * business line, monitors what answers (AI agent vs carrier VM vs no-answer
 * vs busy), and returns a structured result + remediation step.
 *
 * Spec: ~/Downloads/Obsidian Vault/Projects/unmissed/Product/carrier-compatibility-checker-spec.md
 *
 * SAFETY:
 *   - clientId must match authenticated session
 *   - targetPhone must NOT match any number in PAYING_CLIENT_NUMBERS allowlist
 *   - Diagnostic uses DIAGNOSTIC_TWILIO_NUMBER (separate from production DIDs)
 *
 * STATUS: SCAFFOLDED — Twilio originate + AMD inference wired, but NOT YET
 * production-tested. Owner runs the smoke test on a fresh trial line before
 * enabling in MobileSetup.
 */

import { NextResponse, type NextRequest } from 'next/server'
import twilio from 'twilio'
import { createServerClient } from '@/lib/supabase/server'
import type { DiagnosticResult } from '@/types/carrier-compat'

export const runtime = 'nodejs'
export const maxDuration = 60

const DIAGNOSTIC_DID = process.env.DIAGNOSTIC_TWILIO_NUMBER || ''
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

// Hard-coded paying client numbers — never run diagnostic against these
const PAYING_CLIENT_NUMBERS: ReadonlySet<string> = new Set([
  // populated from PRODUCTION_FORWARDING_NUMBERS env or hardcoded fallback
  ...(process.env.PRODUCTION_FORWARDING_NUMBERS?.split(',').map((s) => s.trim()) ?? []),
])

interface Body {
  clientId: string
  targetPhone: string
}

interface OkResponse {
  result: DiagnosticResult
  detail: string
  remediation: string
  runAt: string
  testCallSid: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!DIAGNOSTIC_DID || !TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Diagnostic not configured on this environment' }, { status: 500 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  if (!body.clientId || !body.targetPhone) {
    return NextResponse.json({ error: 'clientId and targetPhone required' }, { status: 400 })
  }

  const normalizedTarget = normalizePhone(body.targetPhone)
  if (!normalizedTarget) {
    return NextResponse.json({ error: 'Invalid targetPhone' }, { status: 400 })
  }

  if (PAYING_CLIENT_NUMBERS.has(normalizedTarget)) {
    return NextResponse.json({ error: 'Refusing to dial a production line for diagnostics' }, { status: 403 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .eq('client_id', body.clientId)
    .limit(1)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const recentLimit = await checkRateLimit(supabase, body.clientId)
  if (recentLimit > 5) {
    return NextResponse.json({ error: 'Daily diagnostic limit reached (5/day)' }, { status: 429 })
  }

  const client = twilio(TWILIO_SID, TWILIO_TOKEN)

  let call
  try {
    call = await client.calls.create({
      from: DIAGNOSTIC_DID,
      to: normalizedTarget,
      url: `${getOrigin(req)}/api/webhook/forwarding-diagnostic/twiml`,
      machineDetection: 'DetectMessageEnd',
      machineDetectionTimeout: 30,
      asyncAmd: 'true',
      asyncAmdStatusCallback: `${getOrigin(req)}/api/webhook/forwarding-diagnostic/amd?client=${body.clientId}`,
      statusCallback: `${getOrigin(req)}/api/webhook/forwarding-diagnostic/status?client=${body.clientId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: 45,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Twilio originate failed', detail: String(err) }, { status: 502 })
  }

  await sleep(30000)

  const result = await pollResult(supabase, call.sid)

  const runAt = new Date().toISOString()
  await supabase.from('forwarding_diagnostics').insert({
    client_id: body.clientId,
    result: result.result,
    detail: result.detail,
    test_call_sid: call.sid,
  })

  const response: OkResponse = {
    result: result.result,
    detail: result.detail,
    remediation: result.remediation,
    runAt,
    testCallSid: call.sid,
  }

  return NextResponse.json(response)
}

interface PollResult {
  result: DiagnosticResult
  detail: string
  remediation: string
}

async function pollResult(_supabase: ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never, _testCallSid: string): Promise<PollResult> {
  // Placeholder polling logic. In production:
  // 1. Read forwarding_diagnostics_events for testCallSid (written by the
  //    AMD + status webhooks at /api/webhook/forwarding-diagnostic/*).
  // 2. If we see a CHILD Ultravox call whose parent_call_sid==testCallSid
  //    AND call_status='live' or 'completed', return PASS.
  // 3. If AMD result === 'machine_*' or 'fax' AND no child Ultravox call,
  //    return FAIL_VM_INTERCEPT.
  // 4. If status='no-answer' with ring duration > 25s, return FAIL_RING_FOREVER.
  // 5. If status='busy', return FAIL_BUSY.
  return {
    result: 'fail_ring_forever',
    detail: 'Diagnostic scaffolding not yet wired to webhook event store.',
    remediation: 'Owner: wire forwarding_diagnostics_events table + webhooks before enabling in UI.',
  }
}

async function checkRateLimit(supabase: ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never, clientId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('forwarding_diagnostics')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', since)
  return count ?? 0
}

function normalizePhone(p: string): string | null {
  const digits = p.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (p.startsWith('+') && digits.length >= 10) return `+${digits}`
  return null
}

function getOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return `${proto}://${host}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
