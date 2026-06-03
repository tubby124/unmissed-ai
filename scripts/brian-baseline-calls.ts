import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'
const LIMIT = 50

type Turn = { role?: string; text?: string; toolName?: string; tool_name?: string; content?: string; type?: string }

async function main(): Promise<void> {
  const { data, error } = await svc
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, caller_name, started_at, duration_seconds, call_status, end_reason, ai_summary, key_topics, service_type, sentiment, quality_score, transcript, call_state')
    .eq('client_id', CLIENT_ID)
    .order('started_at', { ascending: false })
    .limit(LIMIT)

  if (error) { console.error('ERR:', error.message); process.exit(1) }
  const calls = (data ?? []) as any[]
  console.log(`Found ${calls.length} calls`)

  const outDir = '/tmp/brian-audit'
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'baseline-calls.json'), JSON.stringify(calls, null, 2))

  let toolFires = { queryKnowledge: 0, submitMaintenanceRequest: 0, hangUp: 0, sendTextMessage: 0 }
  let totalDur = 0, voicemails = 0, policyQuestions = 0, agentHangup = 0
  const policyKeywords = ['areas', 'pricing', 'screening', 'services', 'rent guarantee', 'hours', 'how does', 'how do', 'what is', 'do you', 'are you']
  const wrongIndustry: string[] = []

  // Agent re-greeting / topic-presumption detection (Bug 3)
  let returningCaller = 0, returningPresumedTopic = 0

  const rows: string[] = []
  rows.push('| # | started | name | dur | status | service | sentiment | summary | KB | MR | HU |')
  rows.push('|---|---|---|---:|---|---|---|---|:---:|:---:|:---:|')

  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]
    const dur = c.duration_seconds ?? 0
    totalDur += dur
    if (String(c.call_status || '').toUpperCase().includes('VOICEMAIL')) voicemails++
    if (c.end_reason === 'agent_hangup') agentHangup++
    const summary = (c.ai_summary ?? '').slice(0, 80).replace(/\|/g, '\\|').replace(/\n/g, ' ')
    const sumLower = (c.ai_summary ?? '').toLowerCase()
    if (policyKeywords.some(k => sumLower.includes(k))) policyQuestions++
    // Detect wrong-industry routing (painting, plumber, etc.) — Brian is property management only
    const wrongIndustryHits = ['painting', 'paint job', 'plumb', 'roof', 'flooring', 'window install'].filter(w => sumLower.includes(w))
    if (wrongIndustryHits.length > 0) wrongIndustry.push(`${c.id.slice(0, 8)}: ${wrongIndustryHits.join(',')} | ${summary}`)

    // Tool fires: transcripts don't store tool calls — use call_state.knowledgeQueries (the canonical counter).
    // Also count submitMaintenanceRequest by checking call_state.fieldsCollected for maintenance fields.
    const state = (typeof c.call_state === 'string' ? JSON.parse(c.call_state) : c.call_state) ?? {}
    const kb = Number(state.knowledgeQueries ?? 0)
    const transcript: Turn[] = Array.isArray(c.transcript) ? c.transcript : []
    // submitMaintenanceRequest leaves a trace: lastToolOutcome or fieldsCollected has unit_number / tenant_name
    const fields = Array.isArray(state.fieldsCollected) ? state.fieldsCollected : []
    const mr = (state.lastToolOutcome === 'submitMaintenanceRequest' || fields.includes('unit_number') || fields.includes('maintenance_request_submitted')) ? 1 : 0
    // hangUp + sendTextMessage — best-effort from end_reason
    const hu = c.end_reason === 'agent_hangup' ? 1 : 0
    const sms = c.in_call_sms_sent ? 1 : 0
    toolFires.queryKnowledge += kb
    toolFires.submitMaintenanceRequest += mr
    toolFires.hangUp += hu
    toolFires.sendTextMessage += sms

    // Bug 3 — returning-caller topic presumption. PROPER detection:
    // The agent says "again" in the opener when greeting a returning caller. If the FIRST agent turn
    // contains "again" or "good to hear from you" AND a presumptive question about a specific topic,
    // count it as a presumption.
    const firstAgentTurn = transcript.find(t => t.role === 'agent' || t.role === 'assistant')
    const firstText = String(firstAgentTurn?.text || firstAgentTurn?.content || '').toLowerCase()
    const isReturningGreeting = /again\b|good to hear from you|hey \w+,? it's eric/i.test(firstText)
    if (isReturningGreeting) {
      returningCaller++
      // Presumes a topic if first turn mentions: any specific noun beyond a generic "how can I help"
      // Patterns: "following up on", "about that", "your friend", "the rent payment", "your unit", "the wire transfer", etc.
      const presumesTopic = /following up on|about that|regarding|checking in on|your friend|that wire|your unit|the rent|on the .* (project|payment|inquiry|request|repair|issue|booking)/i.test(firstText)
      // Also presumes if first turn asks anything other than "how can I help you today?" / "how's it going"
      const isOpenQuestion = /how can i help|how's it going|how are you|what can i do for you|what's up/i.test(firstText)
      if (presumesTopic || (!isOpenQuestion && firstText.includes('?'))) returningPresumedTopic++
    }

    const startedShort = String(c.started_at ?? '').replace('T', ' ').slice(0, 16)
    rows.push(`| ${i + 1} | ${startedShort} | ${c.caller_name ?? '?'} | ${dur}s | ${c.call_status} | ${c.service_type ?? ''} | ${c.sentiment ?? ''} | ${summary} | ${kb} | ${mr} | ${hu} |`)
  }

  const mdPath = path.join(outDir, 'baseline-scores.md')
  const md = [
    `# Brian baseline — last ${calls.length} calls (Calgary Edmonton Property Leasing)`,
    `Pulled 2026-06-02 · client_id=${CLIENT_ID} · agent persona=Eric`,
    ``,
    `## Aggregate`,
    `- Total calls: **${calls.length}**`,
    `- Voicemails: ${voicemails}`,
    `- Avg duration: **${calls.length ? Math.round(totalDur / calls.length) : 0}s**`,
    `- Agent hangup (clean close): ${agentHangup} / ${calls.length}`,
    `- Calls where summary mentions policy topic (areas/pricing/services/screening/hours/rent guarantee): **${policyQuestions}**`,
    ``,
    `## Tool fires (total across all calls)`,
    `- queryKnowledge: **${toolFires.queryKnowledge}**`,
    `- submitMaintenanceRequest: **${toolFires.submitMaintenanceRequest}**`,
    `- hangUp: **${toolFires.hangUp}**`,
    `- sendTextMessage: **${toolFires.sendTextMessage}**`,
    ``,
    `## Knowledge-trigger gap analysis`,
    `- Policy-question calls: **${policyQuestions}**`,
    `- queryKnowledge fires: **${toolFires.queryKnowledge}**`,
    `- **Gap:** ${policyQuestions - toolFires.queryKnowledge} policy questions that should have triggered queryKnowledge but didn't.`,
    `- Hit rate: **${policyQuestions > 0 ? Math.round((toolFires.queryKnowledge / policyQuestions) * 100) : 0}%**`,
    ``,
    `## Bug 3 — returning-caller topic presumption`,
    `- Returning callers (caller_name set): **${returningCaller}**`,
    `- Agent's first turn presumed a topic ("following up on", "about that", etc.): **${returningPresumedTopic}**`,
    `- Presumption rate: **${returningCaller > 0 ? Math.round((returningPresumedTopic / returningCaller) * 100) : 0}%**`,
    ``,
    `## Wrong-industry routing flags (caller appeared to be for a different business)`,
    wrongIndustry.length === 0 ? '_None detected._' : wrongIndustry.map(w => `- ${w}`).join('\n'),
    ``,
    `## Per-call table`,
    ...rows,
  ].join('\n')
  fs.writeFileSync(mdPath, md)
  console.log(`Wrote ${mdPath}`)
  console.log(`\n=== SUMMARY ===`)
  console.log(`policy-question calls: ${policyQuestions} | queryKnowledge fires: ${toolFires.queryKnowledge} | hit rate: ${policyQuestions > 0 ? Math.round((toolFires.queryKnowledge / policyQuestions) * 100) : 0}%`)
  console.log(`returning callers: ${returningCaller} | presumed topic: ${returningPresumedTopic} | presumption rate: ${returningCaller > 0 ? Math.round((returningPresumedTopic / returningCaller) * 100) : 0}%`)
  console.log(`wrong-industry calls: ${wrongIndustry.length}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
