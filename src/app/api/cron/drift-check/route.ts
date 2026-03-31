/**
 * POST /api/cron/drift-check
 *
 * Periodic Supabase ↔ Ultravox prompt drift check.
 * Runs every 6 hours via Railway cron.
 *
 * For each active client with an ultravox_agent_id:
 *   1. Fetches live Ultravox systemPrompt
 *   2. Compares to clients.system_prompt
 *   3. If drifted: auto-fixes via updateAgent(), updates last_agent_sync_status='error' → 'success'
 *   4. If in sync: updates last_agent_sync_status='success', last_agent_sync_at
 *   5. Sends one Telegram summary alert if any clients were drifted
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { sendAlert } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!cronSecret || token !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, booking_enabled, ultravox_agent_id, transfer_conditions, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status')
    .eq('status', 'active')
    .not('ultravox_agent_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ checked: 0, drifted: [], fixed: [], errors: [] })

  const drifted: string[] = []
  const fixed: string[] = []
  const alreadySynced: string[] = []
  const errors: { slug: string; error: string }[] = []
  const now = new Date().toISOString()

  await Promise.all(clients.map(async (client) => {
    if (!client.system_prompt || !client.ultravox_agent_id) return

    try {
      const res = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
        headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
        signal: AbortSignal.timeout(15_000),
      })

      if (!res.ok) {
        errors.push({ slug: client.slug, error: `GET agent HTTP ${res.status}` })
        return
      }

      const agentData = await res.json()
      const livePrompt: string = agentData.callTemplate?.systemPrompt ?? ''

      // Normalize: strip the injected {{callerContext}} suffix added by updateAgent
      const normalizedLive = livePrompt.replace(/\n\n\{\{callerContext\}\}[\s\S]*$/, '').trimEnd()
      const normalizedSaved = (client.system_prompt as string).trimEnd()

      const inSync = normalizedLive === normalizedSaved

      if (inSync) {
        // Mark as confirmed-synced
        await supabase.from('clients').update({
          last_agent_sync_at: now,
          last_agent_sync_status: 'success',
          last_agent_sync_error: null,
        }).eq('id', client.id)
        alreadySynced.push(client.slug)
        return
      }

      // Drift detected — mark error, then auto-fix
      drifted.push(client.slug)
      await supabase.from('clients').update({
        last_agent_sync_at: now,
        last_agent_sync_status: 'error',
        last_agent_sync_error: 'Prompt drift detected by drift-check cron',
      }).eq('id', client.id)

      // Auto-fix: push Supabase → Ultravox
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await supabase
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: client.system_prompt as string,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id as string } : {}),
        booking_enabled: (client.booking_enabled as boolean) ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: (client.sms_enabled as boolean) ?? false,
        twilio_number: (client.twilio_number as string | null) || undefined,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
        selectedPlan: (client.selected_plan as string | null) || undefined,
        subscriptionStatus: (client.subscription_status as string | null) || undefined,
      }

      await updateAgent(client.ultravox_agent_id as string, agentFlags)

      // Sync clients.tools
      const syncTools = buildAgentTools(agentFlags)
      await supabase.from('clients').update({
        tools: syncTools,
        last_agent_sync_at: new Date().toISOString(),
        last_agent_sync_status: 'success',
        last_agent_sync_error: null,
      }).eq('id', client.id)

      fixed.push(client.slug)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ slug: client.slug, error: msg })
      try {
        await supabase.from('clients').update({
          last_agent_sync_at: now,
          last_agent_sync_status: 'error',
          last_agent_sync_error: msg.slice(0, 500),
        }).eq('id', client.id)
      } catch { /* best-effort */ }
    }
  }))

  // Send Telegram alert if any clients had drift or errors
  const hasIssues = drifted.length > 0 || errors.length > 0
  if (hasIssues) {
    const opToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
    const opChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
    if (opToken && opChat) {
      const lines: string[] = ['🔄 <b>Agent Drift Check Alert</b>']
      if (drifted.length > 0) {
        lines.push(`\n✅ <b>Auto-fixed (${fixed.length}/${drifted.length}):</b> ${fixed.join(', ') || '—'}`)
        if (drifted.length > fixed.length) {
          const notFixed = drifted.filter(s => !fixed.includes(s))
          lines.push(`❌ <b>Fix failed:</b> ${notFixed.join(', ')}`)
        }
      }
      if (errors.length > 0) {
        lines.push(`\n⚠️ <b>Errors:</b>`)
        errors.forEach(e => lines.push(`  • ${e.slug}: ${e.error.slice(0, 100)}`))
      }
      lines.push(`\n<i>Checked ${clients.length} clients • ${alreadySynced.length} already in sync</i>`)
      await sendAlert(opToken, opChat, lines.join('\n')).catch(() => {})
    }
  }

  console.log(`[drift-check] checked=${clients.length} synced=${alreadySynced.length} drifted=${drifted.length} fixed=${fixed.length} errors=${errors.length}`)
  return NextResponse.json({ checked: clients.length, alreadySynced, drifted, fixed, errors })
}
