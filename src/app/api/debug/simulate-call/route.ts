/**
 * POST /api/debug/simulate-call
 *
 * Runs the full call-completion pipeline (classify → Supabase → Telegram)
 * using a caller-supplied transcript instead of fetching from Ultravox.
 * Gated by Authorization: Bearer <ADMIN_PASSWORD>.
 *
 * Body:
 *   slug           string   — client slug (e.g. "hasan-sharif")
 *   transcript     Array<{ role: "agent"|"user", text: string }>
 *   caller_phone?  string   — defaults to "+15550000000"
 *   duration_seconds? number — defaults to 120
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'
import crypto from 'crypto'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // ── Auth gate ────────────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!adminPassword || token !== adminPassword) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const slug = body.slug as string | undefined
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const transcript = body.transcript as Array<{ role: string; text: string }> | undefined
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ error: 'transcript required — array of {role, text}' }, { status: 400 })
  }

  const callerPhone = (body.caller_phone as string | undefined) || '+15550000000'
  const durationSeconds = typeof body.duration_seconds === 'number' ? body.duration_seconds : 120
  const fakeCallId = `sim-${crypto.randomUUID()}`

  const supabase = createServiceClient()

  // ── Fetch client ─────────────────────────────────────────────────────────────
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, business_name, niche, telegram_bot_token, telegram_chat_id')
    .eq('slug', slug)
    .single()

  if (!client) {
    return NextResponse.json({ error: `Client not found for slug="${slug}": ${clientError?.message}` }, { status: 404 })
  }

  // ── Insert synthetic live row ─────────────────────────────────────────────────
  const { error: insertError } = await supabase.from('call_logs').insert({
    ultravox_call_id: fakeCallId,
    client_id: client.id,
    caller_phone: callerPhone,
    call_status: 'live',
    started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
  })
  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 })
  }

  // ── Classify ─────────────────────────────────────────────────────────────────
  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')
  const classification = await classifyCall(transcript, businessContext || undefined)

  // ── Update row (live → final status) ─────────────────────────────────────────
  const endedAt = new Date().toISOString()
  const { data: updatedRows, error: updateError } = await supabase
    .from('call_logs')
    .update({
      transcript,
      call_status: classification.status,
      ai_summary: classification.summary,
      service_type: classification.serviceType,
      duration_seconds: durationSeconds,
      ended_at: endedAt,
      end_reason: 'hangup',
      confidence: classification.confidence,
      sentiment: classification.sentiment,
      key_topics: classification.key_topics?.length ? classification.key_topics : null,
      next_steps: classification.next_steps,
      quality_score: classification.quality_score,
    })
    .eq('ultravox_call_id', fakeCallId)
    .select('id')

  if (updateError) {
    return NextResponse.json({ error: `DB update failed: ${updateError.message}`, classification }, { status: 500 })
  }

  // ── Telegram alert ────────────────────────────────────────────────────────────
  let telegramSent = false
  if (client.telegram_bot_token && client.telegram_chat_id) {
    const mins = Math.floor(durationSeconds / 60)
    const secs = durationSeconds % 60
    const durationStr = `${mins}:${String(secs).padStart(2, '0')} min`
    const bizName = client.business_name || slug

    const sentimentEmoji: Record<string, string> = {
      positive: '😊', neutral: '😐', negative: '😟', frustrated: '😤', indifferent: '😑',
    }
    const sentimentIcon = sentimentEmoji[classification.sentiment || ''] ?? '😐'
    const topicsLine = classification.key_topics?.length ? `🔑 ${classification.key_topics.join(', ')}` : ''
    const serviceLabel = classification.serviceType && classification.serviceType !== 'other'
      ? `🏷 ${classification.serviceType.replace(/_/g, ' ')}` : ''
    const confidence = classification.confidence != null ? `🎯 ${classification.confidence}%` : ''
    const summary = classification.summary || 'No summary.'
    const nextSteps = classification.next_steps || ''

    let message: string
    if (classification.status === 'HOT') {
      message = [
        `⚡ <b>[SIM] ACTION REQUIRED — HOT LEAD</b>`, `━━━━━━━━━━━━━━━━`,
        `🏢 <b>${bizName}</b>`,
        `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence} | ${sentimentIcon}`,
        ``, `💬 <b>Summary:</b>`, summary,
        [serviceLabel, topicsLine].filter(Boolean).join(' | '),
        nextSteps ? `\n📋 <b>NEXT:</b> ${nextSteps}` : '',
      ].filter(s => s !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    } else if (classification.status === 'WARM') {
      message = [
        `🟡 <b>[SIM] WARM LEAD — ${bizName}</b>`,
        `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence} | ${sentimentIcon}`,
        ``, `💬 ${summary}`,
        [serviceLabel, topicsLine].filter(Boolean).join(' | '),
        nextSteps ? `📋 <b>NEXT:</b> ${nextSteps}` : '',
      ].filter(Boolean).join('\n')
    } else if (classification.status === 'COLD') {
      message = [
        `❄️ <b>[SIM] COLD — ${bizName}</b>`,
        `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence}`,
        `💬 ${summary}`,
        nextSteps ? `📋 ${nextSteps}` : '',
      ].filter(Boolean).join('\n')
    } else if (classification.status === 'UNKNOWN') {
      message = [
        `⚠️ <b>[SIM] UNKNOWN — manual review needed</b>`,
        `🏢 ${bizName} | 📱 ${callerPhone} | ⏱ ${durationStr}`,
        `💬 ${summary}`,
        `📋 Classification failed — open dashboard to review manually.`,
      ].filter(Boolean).join('\n')
    } else {
      message = `🗑️ <b>[SIM] JUNK — ${bizName}</b> | ${callerPhone} | ⏱ ${durationStr} | ${classification.serviceType}\nNo action required.`
    }

    telegramSent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message)
  }

  return NextResponse.json({
    ok: true,
    fake_call_id: fakeCallId,
    supabase_row_id: updatedRows?.[0]?.id ?? null,
    classification,
    telegram_sent: telegramSent,
    transcript_messages: transcript.length,
  })
}
