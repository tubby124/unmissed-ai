import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'

export const maxDuration = 120

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const callId = (payload.callId || payload.call_id) as string | undefined
  if (!callId) {
    return new NextResponse('Missing callId', { status: 400 })
  }

  const metadata = (payload.metadata || {}) as Record<string, string>
  const callerPhone = metadata.caller_phone || 'unknown'

  // Return 200 IMMEDIATELY — Ultravox fires this 3-4x
  after(async () => {
    try {
      const supabase = createServiceClient()

      // Atomic dedup insert — catches duplicate callbacks via UNIQUE on ultravox_call_id
      const { error: insertError } = await supabase.from('call_logs').insert({
        ultravox_call_id: callId,
        caller_phone: callerPhone,
        call_status: 'processing',
        started_at: new Date().toISOString(),
      })

      if (insertError) {
        if (insertError.code === '23505') return // Already processed
        console.error('[completed] Insert error:', insertError)
        return
      }

      // Fetch client
      const { data: client } = await supabase
        .from('clients')
        .select('id, telegram_bot_token, telegram_chat_id')
        .eq('slug', slug)
        .single()

      if (!client) {
        console.error('[completed] Client not found for slug:', slug)
        return
      }

      // Fetch transcript from Ultravox
      const transcript = await getTranscript(callId)

      // Classify with Claude Haiku via OpenRouter
      const classification = await classifyCall(transcript)

      const durationSeconds = typeof payload.duration === 'number' ? payload.duration : 0

      // Update call_log with full data
      await supabase
        .from('call_logs')
        .update({
          client_id: client.id,
          transcript,
          call_status: classification.status,
          ai_summary: classification.summary,
          service_type: classification.serviceType,
          duration_seconds: durationSeconds,
          ended_at: new Date().toISOString(),
        })
        .eq('ultravox_call_id', callId)

      // Send Telegram alert
      if (client.telegram_bot_token && client.telegram_chat_id) {
        const statusEmoji = {
          HOT: '🔥',
          WARM: '🟡',
          COLD: '❄️',
          JUNK: '🗑️',
        }[classification.status] ?? '📞'

        const mins = Math.floor(durationSeconds / 60)
        const secs = durationSeconds % 60
        const durationStr = durationSeconds > 0
          ? `${mins}:${String(secs).padStart(2, '0')}`
          : 'n/a'

        const message = [
          `${statusEmoji} <b>${classification.status} LEAD</b>`,
          `📱 ${callerPhone}`,
          `⏱ ${durationStr}`,
          `📝 ${classification.summary}`,
          classification.serviceType !== 'other'
            ? `🏷 ${classification.serviceType}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')

        await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message)
      }
    } catch (err) {
      console.error('[completed] Processing error:', err)
    }
  })

  return new NextResponse('OK', { status: 200 })
}
