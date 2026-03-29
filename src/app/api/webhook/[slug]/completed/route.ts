import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, getRecordingStream, verifyCallbackSig } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'
import { notifySystemFailure } from '@/lib/admin-alerts'
import {
  sendTelegramNotification,
  sendSmsFollowUp,
  sendEmailNotification,
  notificationsAlreadySent,
  type CompletedClient,
} from '@/lib/completed-notifications'
import { getSignedRecordingUrl } from '@/lib/recording-url'
import { analyzeTranscriptServer, isEmptyInsight, type ServerClientConfig, type AnalysisMessage } from '@/lib/transcript-analysis'
import { embedText } from '@/lib/embeddings'
import { analyzeQualityMetrics } from '@/lib/quality-metrics'
import { tryAcquireSuggestionLock, fetchRecentInsights, isFailedCall, generateAndStoreSuggestions } from '@/lib/prompt-suggestions'

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

  const callData = payload.call as Record<string, unknown> | undefined
  const callId = (callData?.callId || payload.callId || payload.call_id) as string | undefined

  if (!callId) {
    console.error('[completed] Missing callId in payload:', JSON.stringify(payload).slice(0, 500))
    return new NextResponse('Missing callId', { status: 400 })
  }

  // ── HMAC signature verification (S13b: mandatory when secret configured) ──
  const sig = req.nextUrl.searchParams.get('sig')
  const nonce = req.nextUrl.searchParams.get('n') || req.nextUrl.searchParams.get('nonce')
  const ts = req.nextUrl.searchParams.get('t') || req.nextUrl.searchParams.get('ts')
  const hasSecret = !!process.env.WEBHOOK_SIGNING_SECRET

  if (hasSecret && !sig) {
    // S13b-T1b: reject unsigned webhooks when signing is enabled
    console.error(`[completed] REJECTED — no sig param, WEBHOOK_SIGNING_SECRET is set. slug=${slug} callId=${callId}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (sig) {
    const result = verifyCallbackSig(slug, sig, nonce, ts)
    if (!result.valid) {
      console.error(`[completed] HMAC sig FAILED for slug=${slug} callId=${callId} format=${result.legacy ? 'legacy' : 'new'} — forged webhook rejected`)
      return new NextResponse('Forbidden', { status: 403 })
    }
    if (result.legacy) {
      console.warn(`[completed] HMAC sig verified (LEGACY format — in-flight call) for slug=${slug} callId=${callId}`)
    } else {
      console.log(`[completed] HMAC sig verified for slug=${slug} callId=${callId}`)
    }
  }

  // Duration from Ultravox timestamps
  let durationSeconds = 0
  if (callData?.joined && callData?.ended) {
    durationSeconds = Math.round(
      (new Date(callData.ended as string).getTime() - new Date(callData.joined as string).getTime()) / 1000
    )
  }

  const metadata = (callData?.metadata || payload.metadata || {}) as Record<string, string>
  const callerPhone = metadata.caller_phone || 'unknown'
  const endReason = (callData?.endReason as string | undefined) || null
  const ultravoxSummary = (callData?.shortSummary as string | undefined) || null
  const endedAt = (callData?.ended as string | undefined) || new Date().toISOString()

  // B3-F2: Extract final call state from Ultravox callback (null if not present)
  const finalCallState = (callData?.state as Record<string, unknown> | undefined) ?? null

  // Return 200 immediately — Ultravox retries up to 10x with exponential backoff
  after(async () => {
    const afterStartMs = Date.now()
    console.log(`[completed:after:start] callId=${callId} slug=${slug}`)
    console.log(`[completed] Processing: callId=${callId} slug=${slug} duration=${durationSeconds}s callerPhone=${callerPhone}`)
    try {
      const supabase = createServiceClient()

      // Skip processing for transferred calls — transfer webhook already marked them.
      // The real conversation data comes from the recovery call (if any), not this one.
      const { data: existingRow } = await supabase
        .from('call_logs')
        .select('call_status')
        .eq('ultravox_call_id', callId)
        .single()
      if (existingRow?.call_status === 'transferred') {
        console.log(`[completed] Skipping transferred call callId=${callId} — no SMS/Telegram/classification needed`)
        return
      }

      // Test/trial calls: process fully (classification, gaps, insights) but skip notifications
      const isTestCall = existingRow?.call_status === 'test' || existingRow?.call_status === 'trial_test'
      if (isTestCall) {
        console.log(`[completed] Test call detected (${existingRow?.call_status}) callId=${callId} — will classify + detect gaps, skip notifications`)
      }

      // Atomic dedup: transition 'live'/'test'/'trial_test' → 'processing'
      const { data: locked } = await supabase
        .from('call_logs')
        .update({ call_status: 'processing' })
        .eq('ultravox_call_id', callId)
        .in('call_status', ['live', 'test', 'trial_test'])
        .select('id')

      if (!locked?.length) {
        // S9g: Check for stale processing row (crash recovery)
        // If a previous webhook attempt crashed after live→processing but before completing,
        // the row is stuck. Re-acquire if updated_at is >60s stale.
        const staleThreshold = new Date(Date.now() - 60_000).toISOString()
        const { data: recovered } = await supabase
          .from('call_logs')
          .update({ call_status: 'processing' })
          .eq('ultravox_call_id', callId)
          .eq('call_status', 'processing')
          .lt('updated_at', staleThreshold)
          .select('id')

        if (recovered?.length) {
          console.warn(`[completed] RECOVERY: re-acquired stale processing lock for callId=${callId} rowId=${recovered[0].id}`)
        } else {
          // No stale row — try fresh insert (first-time completion without inbound row)
          console.warn(`[completed] No live/stale row for callId=${callId} — attempting fresh insert`)
          const { error: insertError } = await supabase.from('call_logs').insert({
            ultravox_call_id: callId,
            caller_phone: callerPhone,
            call_status: 'processing',
            started_at: new Date().toISOString(),
          })
          if (insertError) {
            console.error(`[completed] Insert fallback failed for callId=${callId}: ${insertError.message} — likely duplicate or active processing, bailing`)
            return
          }
        }
      } else {
        console.log(`[completed] Lock acquired: callId=${callId} rowId=${locked[0].id}`)
      }

      // Fetch client — includes sms_enabled for post-call SMS
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, niche, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled, booking_enabled, forwarding_number, business_hours_weekday, knowledge_backend, website_url, website_scrape_status, business_facts, extra_qa, system_prompt')
        .eq('slug', slug)
        .single()

      if (!client) {
        console.error(`[completed] Client not found for slug=${slug} error=${clientError?.message || 'null row'}`)
        return
      }
      console.log(`[completed] Client: slug=${slug} id=${client.id} business="${client.business_name}" hasTelegram=${!!(client.telegram_bot_token && client.telegram_chat_id)}`)

      // Fetch transcript
      const transcript = await getTranscript(callId)
      console.log(`[completed] Transcript: callId=${callId} messages=${transcript.length}`)

      // ── Canary token leak detection ────────────────────────────────────────
      if (JSON.stringify(transcript).includes('CNRY-UV-7F3X')) {
        console.error(`[completed] CRITICAL — CANARY TOKEN LEAKED — prompt contamination detected for slug=${slug} callId=${callId}`)
      }

      // ── endReason-based pre-classification (C1 safeguard) ──────────────────────
      let skipClassification = false
      let preClassifiedStatus: string | null = null

      if (endReason === 'unjoined') {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=unjoined → auto-classify MISSED for callId=${callId}`)
      } else if (endReason === 'timeout' && durationSeconds < 5) {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=timeout + ${durationSeconds}s < 5s → auto-classify MISSED for callId=${callId}`)
      } else if (endReason === 'connection_error' || endReason === 'system_error') {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=${endReason} → auto-classify MISSED + ops alert for callId=${callId}`)
      }

      // Classify with Claude Haiku via OpenRouter (skip if pre-classified by endReason)
      let classification
      if (skipClassification && preClassifiedStatus) {
        classification = {
          status: preClassifiedStatus,
          summary: `Call ended: ${endReason}${durationSeconds > 0 ? ` (${durationSeconds}s)` : ''}`,
          serviceType: 'other' as const,
          confidence: 100,
          sentiment: 'neutral' as const,
          key_topics: [] as string[],
          next_steps: '',
          quality_score: 0,
        }
        console.log(`[completed] Pre-classified: callId=${callId} status=${preClassifiedStatus} endReason=${endReason}`)
      } else {
        const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')
        classification = await classifyCall(transcript, businessContext || undefined, (client.classification_rules as string | null) || undefined, (client.niche as string | null) || undefined)
        console.log(`[completed] Classification: callId=${callId} status=${classification.status} confidence=${classification.confidence} summary="${classification.summary.slice(0, 80)}"`)
      }

      // Update call_log with full data
      const { data: updatedRows, error: updateError } = await supabase
        .from('call_logs')
        .update({
          client_id: client.id,
          transcript,
          call_status: classification.status,
          ai_summary: classification.summary || ultravoxSummary || null,
          service_type: classification.serviceType,
          duration_seconds: durationSeconds,
          ended_at: endedAt,
          end_reason: endReason,
          confidence: classification.confidence || null,
          sentiment: classification.sentiment || null,
          key_topics: classification.key_topics?.length ? classification.key_topics : null,
          next_steps: classification.next_steps || null,
          quality_score: classification.quality_score || null,
          caller_name: classification.caller_data?.caller_name ?? classification.niche_data?.caller_name ?? null,
          ...(finalCallState ? { call_state: finalCallState } : {}),
        })
        .eq('ultravox_call_id', callId)
        .select('id')
      if (updateError) console.error(`[completed] DB update FAILED for callId=${callId}: ${updateError.message} code=${updateError.code}`)
      else if (!updatedRows?.length) console.error(`[completed] DB update matched 0 rows for callId=${callId} — check call_status CHECK constraint or RLS`)
      else console.log(`[completed] DB updated: callId=${callId} status=${classification.status} callState=${finalCallState ? 'PRESENT' : 'NOT_IN_PAYLOAD'}`)

      // Call log row ID for notification_logs FK
      const callLogId = updatedRows?.[0]?.id ?? null

      // ── Ops alert for system failures (skip for test calls) ──────────────────
      if (!isTestCall && (endReason === 'connection_error' || endReason === 'system_error')) {
        if (client.telegram_bot_token && client.telegram_chat_id) {
          await sendAlert(
            client.telegram_bot_token,
            client.telegram_chat_id,
            `\u26a0\ufe0f <b>SYSTEM FAILURE</b> [${slug}]\nendReason: ${endReason}\nCaller: ${callerPhone}\nDuration: ${durationSeconds}s\nCall ID: ${callId}`,
            client.telegram_chat_id_2 ?? undefined
          ).catch((e) => console.error(`[completed] Ops alert send failed:`, e))
        }
        console.error(`[completed] SYSTEM FAILURE ALERT: slug=${slug} endReason=${endReason} callId=${callId}`)
      }

      // ── Recording upload (before Telegram so we can include the link) ──────
      let recordingUrl: string | null = null
      try {
        const recordingRes = await getRecordingStream(callId)
        if (recordingRes.ok && recordingRes.body) {
          const arrayBuffer = await recordingRes.arrayBuffer()
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(`${callId}.mp3`, arrayBuffer, { contentType: 'audio/mpeg', upsert: true })
          if (uploadError) {
            console.error(`[completed] Recording upload failed for callId=${callId}: ${uploadError.message}`)
          } else {
            // S13-REC1: store path only (bucket is private). Generate signed URL for notifications.
            const storagePath = `${callId}.mp3`
            await supabase.from('call_logs').update({ recording_url: storagePath }).eq('ultravox_call_id', callId)
            recordingUrl = await getSignedRecordingUrl(storagePath)
            console.log(`[completed] Recording uploaded: callId=${callId} path=${storagePath}`)
          }
        } else {
          console.warn(`[completed] Recording not available for callId=${callId} status=${recordingRes.status}`)
        }
      } catch (storageErr) {
        console.error('[completed] Recording storage failed:', storageErr)
      }

      // ── Notifications: skip for test/trial calls (no Telegram, SMS, or email) ──
      if (isTestCall) {
        console.log(`[completed] Skipping notifications for test call callId=${callId}`)
      } else if (await notificationsAlreadySent(supabase, callLogId)) {
        console.warn(`[completed] IDEMPOTENCY — notifications already sent for callId=${callId} callLogId=${callLogId} — skipping Telegram/SMS/email`)
      } else {
        // Build shared notification context
        const notifCtx = {
          supabase, client: client as CompletedClient, callId, callLogId, slug,
          callerPhone, classification, durationSeconds, endedAt,
          ultravoxSummary, recordingUrl, metadata, transcript,
        }

        // ── Telegram alert ─────────────────────────────────────────────────────
        await sendTelegramNotification(notifCtx)

        // ── SMS post-call follow-up ────────────────────────────────────────────
        await sendSmsFollowUp(notifCtx)

        // ── Voicemail-to-email ─────────────────────────────────────────────────
        await sendEmailNotification(notifCtx)
      }

      // ── Increment seconds used (S9h: idempotent — skip if already counted) ──
      if (durationSeconds > 0) {
        const { data: secCheck } = await supabase
          .from('call_logs')
          .select('seconds_counted')
          .eq('ultravox_call_id', callId)
          .single()

        if (secCheck?.seconds_counted) {
          console.log(`[completed] Seconds already counted for callId=${callId} — skipping increment`)
        } else {
          const { error: rpcError } = await supabase.rpc('increment_seconds_used', {
            p_client_id: client.id,
            p_seconds: durationSeconds,
          })
          if (rpcError) {
            console.error('[completed] Seconds increment failed:', rpcError.message)
          } else {
            const { error: flagError } = await supabase.from('call_logs').update({ seconds_counted: true }).eq('ultravox_call_id', callId)
            if (flagError) console.error(`[completed] seconds_counted flag update FAILED for callId=${callId}: ${flagError.message}`)
            console.log(`[completed] Seconds incremented: clientId=${client.id} +${durationSeconds}s (${Math.ceil(durationSeconds / 60)}min)`)
          }
        }
      }

      // ── G7: Usage threshold alerts (80% and 100%) ────────────────────────────
      // Fire once per billing cycle per threshold. Uses timestamp columns to dedup.
      try {
        const { data: usageRow } = await supabase
          .from('clients')
          .select('seconds_used_this_month, monthly_minute_limit, bonus_minutes, selected_plan, minute_warning_80_sent_at, minute_warning_100_sent_at')
          .eq('id', client.id)
          .single()

        if (usageRow) {
          const minutesUsed = Math.ceil((usageRow.seconds_used_this_month ?? 0) / 60)
          const limit = (usageRow.monthly_minute_limit ?? 100) + (usageRow.bonus_minutes ?? 0)
          const pct = limit > 0 ? (minutesUsed / limit) * 100 : 0
          const botToken = client.telegram_bot_token as string | null
          const chatId = client.telegram_chat_id as string | null

          // 80% threshold — fire once
          if (pct >= 80 && pct < 100 && !usageRow.minute_warning_80_sent_at && botToken && chatId) {
            await sendAlert(botToken, chatId,
              `⚠️ <b>Usage Alert:</b> You've used ${minutesUsed} of ${limit} minutes (${Math.round(pct)}%). Consider upgrading or buying extra minutes.`
            )
            await supabase.from('clients').update({ minute_warning_80_sent_at: new Date().toISOString() }).eq('id', client.id)
            console.log(`[completed] 80% usage alert sent for client=${client.id} (${minutesUsed}/${limit} min)`)
          }

          // 100% threshold — fire once
          if (pct >= 100 && !usageRow.minute_warning_100_sent_at && botToken && chatId) {
            await sendAlert(botToken, chatId,
              `🚨 <b>Minute Limit Reached:</b> You've used ${minutesUsed} of ${limit} minutes. New calls will be blocked until the next billing cycle or until you add more minutes.`
            )
            await supabase.from('clients').update({ minute_warning_100_sent_at: new Date().toISOString() }).eq('id', client.id)
            console.log(`[completed] 100% usage alert sent for client=${client.id} (${minutesUsed}/${limit} min)`)
          }
        }
      } catch (usageErr) {
        console.error('[completed] Usage alert check failed (non-fatal):', usageErr)
      }

      // ── L5: Per-call transcript analysis (keyword-based, $0 cost) ───────────
      if (transcript.length > 0 && callLogId && !skipClassification) {
        try {
          const insight = analyzeTranscriptServer(transcript, client as unknown as ServerClientConfig)

          // 8o: quality metrics from same transcript (heuristic, $0, browser-safe)
          const normalizedMessages: AnalysisMessage[] = transcript.map(t => ({
            role: t.role === 'user' ? 'user' as const : 'agent' as const,
            text: t.text || '',
          }))
          const qualityMetrics = analyzeQualityMetrics(normalizedMessages)

          if (!isEmptyInsight(insight)) {
            const { error: insightError } = await supabase
              .from('call_insights')
              .upsert({
                call_id: callLogId,
                client_id: client.id,
                unanswered_questions: insight.unansweredQuestions,
                feature_suggestions: insight.featureSuggestions,
                caller_frustrated: insight.callerFrustrated,
                repeated_questions: insight.repeatedQuestions,
                agent_confused_moments: insight.agentConfusedMoments,
                source: insight.source,
                // 8o quality metrics
                talk_ratio_agent:     qualityMetrics.talk_ratio_agent,
                agent_confidence:     qualityMetrics.agent_confidence,
                short_turn_count:     qualityMetrics.short_turn_count,
                loop_rate:            qualityMetrics.loop_rate,
                avg_agent_turn_chars: qualityMetrics.avg_agent_turn_chars,
              }, { onConflict: 'call_id' })

            if (insightError) console.error(`[completed] L5 insight write failed for callId=${callId}: ${insightError.message}`)
            else console.log(`[completed] L5 insight saved: callId=${callId} gaps=${insight.unansweredQuestions.length} features=${insight.featureSuggestions.length} frustrated=${insight.callerFrustrated}`)

            // L5→Gaps bridge: feed unanswered questions into knowledge_query_log
            if (insight.unansweredQuestions.length > 0) {
              try {
                // Dedup against existing unresolved gaps
                const { data: existing } = await supabase
                  .from('knowledge_query_log')
                  .select('query_text')
                  .eq('client_id', client.id)
                  .eq('result_count', 0)
                  .is('resolved_at', null)
                  .limit(500)

                const existingNorm = new Set(
                  (existing ?? []).map(r => r.query_text.toLowerCase().trim().replace(/\s+/g, ' '))
                )

                const newGaps = insight.unansweredQuestions
                  .map(q => q.question.trim())
                  .filter(q => q.length > 5)
                  .filter(q => !existingNorm.has(q.toLowerCase().trim().replace(/\s+/g, ' ')))
                  .slice(0, 5)

                if (newGaps.length > 0) {
                  // Embed + insert each gap (enables auto-cascade + preemptive resolve)
                  for (const gapText of newGaps) {
                    const gapEmbed = await embedText(gapText)
                    const row: Record<string, unknown> = {
                      client_id: client.id,
                      slug,
                      query_text: gapText,
                      result_count: 0,
                      source: 'transcript',
                    }
                    if (gapEmbed) row.query_embedding = JSON.stringify(gapEmbed)

                    const { data: inserted } = await supabase
                      .from('knowledge_query_log')
                      .insert(row)
                      .select('id')
                      .single()

                    // Preemptive resolve: auto-close if approved chunk already covers this
                    if (inserted?.id && gapEmbed) {
                      try {
                        await supabase.rpc('try_preemptive_gap_resolve', {
                          p_query_log_id: inserted.id,
                          p_client_id: client.id,
                          p_query_embedding: JSON.stringify(gapEmbed),
                          p_similarity_threshold: 0.90,
                        })
                      } catch { /* non-fatal */ }
                    }
                  }
                  console.log(`[completed] L5→Gaps bridge: inserted ${newGaps.length} transcript gaps for slug=${slug}`)
                }
              } catch (gapBridgeErr) {
                console.error('[completed] L5→Gaps bridge error (non-fatal):', gapBridgeErr)
              }
            }
          }
        } catch (analysisErr) {
          console.error('[completed] L5 analysis error (non-fatal):', analysisErr)
        }

        // ── 8m: Atomic suggestion generation trigger ─────────────────────────
        try {
          const lockAcquired = await tryAcquireSuggestionLock(supabase, client.id)
          if (lockAcquired) {
            const recentInsights = await fetchRecentInsights(supabase, client.id, 7)
            const failureCount = recentInsights.filter(isFailedCall).length
            if (failureCount >= 3) {
              // Fire-and-forget — never block the webhook
              generateAndStoreSuggestions(supabase, client.id, recentInsights, client.system_prompt ?? '')
                .catch((err) => console.error('[8m] suggestion generation failed (non-fatal):', err))
              console.log(`[completed] 8m: lock acquired, triggering suggestions for slug=${slug} failureCount=${failureCount}`)
            } else {
              console.log(`[completed] 8m: lock acquired but failureCount=${failureCount} < 3 — skipping`)
            }
          }
        } catch (suggErr) {
          console.error('[completed] 8m suggestion trigger error (non-fatal):', suggErr)
        }
      }

      console.log(`[completed:after:end] callId=${callId} slug=${slug} elapsed=${Date.now() - afterStartMs}ms`)
    } catch (err) {
      console.error(`[completed:after:error] callId=${callId} slug=${slug} elapsed=${Date.now() - afterStartMs}ms`, err)
      try {
        const crashSupa = createServiceClient()
        await notifySystemFailure(
          `Webhook crash: callId=${callId} slug=${slug}`,
          err,
          crashSupa,
        )
      } catch { /* never let alerting break */ }
    }
  })

  return new NextResponse('OK', { status: 200 })
}
