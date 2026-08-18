/**
 * scripts/aisha-realtor-script-lab.ts
 *
 * Dial-in lab for the REALTOR Lofty-revival prompt (Task 11 verification).
 *
 * Drives Aisha's real production prompt (buildRealtorOutboundPrompt) against
 * scripted client personas on llama-3.3-70b — the same frozen model family
 * Ultravox runs — so behavior is representative of production without
 * burning phone calls or tokens on Twilio.
 *
 * Each scenario plays a full conversation and then SCORES it:
 *   - pass/fail on: no repeated questions, turn cap (<=5 agent turns),
 *     hangUp fired, closing line matches the outcome
 *   - prints a transcript for human review
 *
 * Usage:
 *   source /root/.secrets 2>/dev/null
 *   npx tsx scripts/aisha-realtor-script-lab.ts                # all scenarios
 *   npx tsx scripts/aisha-realtor-script-lab.ts --scenario hot # one scenario
 *   npx tsx scripts/aisha-realtor-script-lab.ts --show-transcript
 *
 * Exit code 0 = all scenarios pass; 1 = any failed (CI-able).
 */

import { buildRealtorOutboundPrompt, type RealtorLeadContext } from '../src/lib/realtor-outbound-prompt'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Agent proxy: gpt-oss-20b with tool_choice none + tool-use retry (fast,
// close to Ultravox's voice-model profile). Lead proxy: gpt-oss-120b.
const AGENT_MODEL = 'openai/gpt-oss-20b'
const LEAD_MODEL = 'openai/gpt-oss-120b'

type Msg =
  | { role: 'system' | 'user' | 'assistant'; content: string }

interface Scenario {
  key: string
  lead: RealtorLeadContext
  persona: string
  expect: {
    outcome: string // substring expected in final summary/labels
    closeLine?: string
  }
  maxAgentTurns?: number
}

const SCENARIOS: Scenario[] = [
  {
    key: 'hot-buyer-bowness',
    lead: {
      loftyLeadId: '4123',
      name: 'Sarah',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'active',
      rawArea: 'Bowness',
      priorAttempts: 0,
    },
    persona:
      "You are Sarah, 31, on the phone with a realtor assistant. You ARE actively looking to buy in Bowness (Calgary), you've been pre-approved, and you want to meet Hasan. You're warm but busy making dinner — short spoken replies (5-20 words). When asked about timing, say 'as soon as possible, within a month'. When offered a call with Hasan, accept and say 'tomorrow at 2 works'. Output ONLY your spoken words.",
    expect: { outcome: 'active_now', closeLine: /tomorrow|call|set up|schedule|book/i },
  },
  {
    key: 'future-timeline',
    lead: {
      loftyLeadId: '4124',
      name: 'Mike',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'inactive',
      rawArea: 'not supplied',
      priorAttempts: 2,
    },
    persona:
      "You are Mike, 40, on the phone. You looked at homes months ago but paused. You're NOT ready yet — probably 5-6 months away, saving more. You're polite but not in a rush. Short spoken replies (5-18 words). If asked about area, say 'probably the NW, maybe Tuscany'. If they offer a follow-up, say 'sure, check back in a few months'. Output ONLY your spoken words.",
    expect: { outcome: 'future_timeline', closeLine: /month|follow|check|back|later/i },
  },
  {
    key: 'not-interested',
    lead: {
      loftyLeadId: '4125',
      name: 'Dave',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'inactive',
      rawArea: 'not supplied',
      priorAttempts: 1,
    },
    persona:
      "You are Dave, 52. You bought a place already and are NOT interested in anything. You want the call to end quickly without being rude. Short replies (4-12 words). If they ask if you're still moving, say 'no, we bought already'. If they keep pushing, get firmer: 'I'm not interested, thanks'. Output ONLY your spoken words.",
    expect: { outcome: 'not_looking', closeLine: /take care|no problem|goodbye|good day/i },
  },
  {
    key: 'wrong-number',
    lead: {
      loftyLeadId: '4126',
      name: 'Emily',
      leadType: 'unknown',
      source: 'lofty',
      pipelineStage: 'unspecified',
      rawArea: 'not supplied',
      priorAttempts: 0,
    },
    persona:
      "You are Emily. You did NOT look at homes — someone gave you the wrong number. You're mildly confused, not angry. Short replies (3-12 words). Say 'I think you have the wrong number, I never looked at homes'. If they apologize and end, say 'no worries, bye'. Output ONLY your spoken words.",
    expect: { outcome: 'wrong_number', closeLine: /sorry|bother|goodbye|good day|wrong number/i },
  },
  {
    key: 'busy-defer',
    lead: {
      loftyLeadId: '4127',
      name: 'Amina',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'active',
      rawArea: 'Bowness',
      priorAttempts: 0,
    },
    persona:
      "You are Amina, 28, at work, whispering. You ARE looking in Bowness but cannot talk right now. Say 'I can't really talk right now' early. If they offer a callback time, accept and say 'after 6 works'. Short whispered replies (3-15 words). Output ONLY your spoken words.",
    // Per the P1 disposition rule: a callback preference/booking = future_timeline
    // (operator schedules the follow-up), NOT active_now. Only a confirmed
    // appointment booked in the calendar inflates to active_now.
    expect: { outcome: 'future_timeline', closeLine: /after 6|later|callback|evening|6/i },
  },
  {
    key: 'ai-skeptic',
    lead: {
      loftyLeadId: '4128',
      name: 'James',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'active',
      rawArea: 'not supplied',
      priorAttempts: 0,
    },
    persona:
      "You are James, 35, on the phone. You are actually interested in buying in the NE of Calgary this year. Rule 1: Your first reply after 'Hello?' must be exactly: 'wait, are you a robot?'. Rule 2: After the caller answers that honestly (yes, an AI assistant), say: 'ok, fine. I'm looking in the NE. Wednesday morning works for a call.' Rule 3: If the caller asks a question, answer it in 3-10 words. Always reply with words — never reply with an empty message.",
    // A callback for Wednesday morning = future_timeline per the P1 disposition
    // rule (confirmed callback scheduled later, not an immediate booking).
    expect: { outcome: 'future_timeline', closeLine: /wednesday|morning|10|set up|check back/i },
  },
  {
    key: 'do-not-call',
    lead: {
      loftyLeadId: '4129',
      name: 'Robert',
      leadType: 'unknown',
      source: 'lofty',
      pipelineStage: 'unspecified',
      rawArea: 'not supplied',
      priorAttempts: 1,
    },
    persona:
      "You are Robert, 60. You're annoyed at being called again. Firmly say 'take me off your list, don't call me again' early. Do not engage beyond that. Short replies (4-10 words). Output ONLY your spoken words.",
    expect: { outcome: 'do_not_call', closeLine: /sorry|remove|no more calls|goodbye|take care/i },
  },
  {
    key: 'vague-area-bonita-trap',
    lead: {
      loftyLeadId: '4130',
      name: 'Priya',
      leadType: 'buyer',
      source: 'lofty',
      pipelineStage: 'active',
      rawArea: 'Bonita', // deliberately corrupt token — must NOT be normalized to Bowness
      priorAttempts: 0,
    },
    persona:
      "You are Priya. You're looking in Bowness but the caller's data may say 'Bonita' — do NOT correct it unless asked. Answer honestly about the area: 'I'm looking in Bowness, near the river'. If the caller asks to confirm the area, confirm Bowness. If they ask when you want to move, say 'this summer'. Short replies (5-18 words). Output ONLY your spoken words.",
    // Area confirm happened mid-convo; the close should be a normal booking close.
    expect: { outcome: 'active_now', closeLine: /talk soon|set up|get that set up|great/i },
  },
]

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : undefined
  }
  return {
    scenario: get('--scenario'),
    showTranscript: args.includes('--show-transcript'),
  }
}

async function groq(model: string, messages: Msg[], maxTokens = 120): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const isOpenAI = model.startsWith('openai/')
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        ...(isOpenAI ? { reasoning_effort: 'low', tools: [], tool_choice: 'none' as const } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)))
      continue
    }
    if (res.status === 400) {
      // gpt-oss sometimes emits a tool call despite tool_choice none. Remind it.
      const body = await res.text()
      if (/tool_use_failed|Tool choice is none/i.test(body)) {
        messages = [
          ...messages,
          { role: 'user', content: 'IMPORTANT: Do not call any tools. Reply with plain text only.' } as Msg,
        ]
        continue
      }
      throw new Error(`Groq ${model} HTTP 400: ${body.slice(0, 200)}`)
    }
    if (!res.ok) throw new Error(`Groq ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
    return (json.choices?.[0]?.message?.content ?? '').trim()
  }
  throw new Error('Groq rate-limited after retries')
}

/** Count repeated questions among agent turns (case-insensitive, trimmed). */
function repeatedQuestions(agentTurns: string[]): string[] {
  const questions = agentTurns
    .map(t => (t.match(/[^.!?]*\?/g) ?? [])[0]?.trim())
    .filter(Boolean) as string[]
  const seen = new Set<string>()
  const repeats: string[] = []
  for (const q of questions) {
    const key = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    if (seen.has(key)) repeats.push(q)
    seen.add(key)
  }
  return repeats
}

async function runScenario(sc: Scenario, showTranscript: boolean): Promise<{ pass: boolean; problems: string[]; turns: number }> {
  const leadName = sc.lead.name
  const prompt = buildRealtorOutboundPrompt(sc.lead)
    .replace(/\{\{LEAD_NAME\}\}/g, leadName)
    .replace(/\{\{LEAD_PHONE\}\}/g, '+140****0123')
    .replace(/\{\{LEAD_FIRST_NAME\}\}/g, leadName.split(' ')[0])

  const agentSystem =
    prompt +
    '\n\n[SIMULATION NOTE: This is a text simulation of a phone call. When you would invoke the hangUp tool, output exactly "[hangUp]" at the end of your final line instead. If you would NOT hang up yet, do not include it.]'

  const leadSystem =
    sc.persona

  const problems: string[] = []
  const agentTurns: string[] = []
  const transcript: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'Hello?' },
  ]
  let turns = 0

  if (showTranscript) console.log(`\n=== SCENARIO: ${sc.key} ===`)
  if (showTranscript) console.log(`LEAD : Hello?`)

  const maxTurns = sc.maxAgentTurns ?? 6
  for (let t = 0; t < maxTurns; t++) {
    // Agent turn — full history so far.
    const agentMsgs: Msg[] = [{ role: 'system', content: agentSystem }, ...transcript]
    const agentLine = await groq(AGENT_MODEL, agentMsgs, 220)
    agentTurns.push(agentLine)
    turns++
    transcript.push({ role: 'assistant', content: agentLine.replace(/\[hangUp\]/gi, '') })
    if (showTranscript) console.log(`AISHA: ${agentLine}`)

    if (/\[hangUp\]/i.test(agentLine)) break

    // Lead turn — full history including the agent's latest.
    const leadMsgs: Msg[] = [{ role: 'system', content: leadSystem }, ...transcript]
    const leadLine = await groq(LEAD_MODEL, leadMsgs, 80)
    transcript.push({ role: 'user', content: leadLine })
    if (showTranscript) console.log(`LEAD : ${leadLine}`)
    if (/\[hangs up\]|\[hang up\]/i.test(leadLine)) break
  }

  // ── Score ──────────────────────────────────────────────────────────────
  const lastAgent = agentTurns[agentTurns.length - 1] ?? ''

  // 1. hangUp fired
  if (!/\[hangUp\]/i.test(lastAgent)) {
    problems.push(`no hangUp detected (${turns} agent turns)`)
  }

  // 2. turn cap
  if (turns > 5) {
    problems.push(`turn cap exceeded: ${turns} agent turns`)
  }

  // 3. repeated questions
  const repeats = repeatedQuestions(agentTurns)
  if (repeats.length) {
    problems.push(`repeated question(s): ${repeats.join(' | ')}`)
  }

  // 4. expected outcome — classify the transcript post-call, like production's
  //    completed-webhook resolver does. This is more reliable than asking the
  //    agent to emit an inline marker (which pollutes the spoken contract).
  const transcriptText = transcript
    .filter(m => m.content && m.content.trim())
    .map(m => `${m.role === 'assistant' ? 'AGENT' : 'LEAD'}: ${m.content}`)
    .join('\n')
  const classifier = await groq(
    LEAD_MODEL,
    [
      {
        role: 'system',
        content:
          'You classify the outcome of an AI realtor outbound call from the full conversation transcript. Rules: a confirmed callback scheduled later = future_timeline (not active_now). A booked/immediate appointment or actively-looking-now with a next step = active_now. Someone who bought / not interested = not_looking. Wrong number = wrong_number. Asked to be removed = do_not_call. Reply with EXACTLY one token: active_now | future_timeline | not_looking | wrong_number | do_not_call | no_answer | voicemail. No explanation.',
      },
      { role: 'user', content: `CONVERSATION:\n${transcriptText.slice(0, 2500)}` },
    ],
    150,
  )
  // gpt-oss is a reasoning model: strip any leftover think-tags and take the
  // first line of actual content.
  const classified = classifier
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
  const actualOutcome = (classified.split(/\s+/)[0] ?? '').toLowerCase()
  if (actualOutcome !== sc.expect.outcome) {
    problems.push(`outcome mismatch: expected '${sc.expect.outcome}', got '${actualOutcome || 'none'}'`)
  }

  // 5. closing line matches expectation
  if (sc.expect.closeLine && !sc.expect.closeLine.test(lastAgent)) {
    problems.push(`closing line mismatch: expected ~${sc.expect.closeLine}`)
  }

  // 6. no recap-echo (no "so just to confirm" / "to summarize")
  if (/(so just to confirm|to summarize|as i mentioned|as i said earlier)/i.test(lastAgent)) {
    problems.push('recap-echo phrase detected in closing')
  }

  const pass = problems.length === 0
  if (showTranscript) {
    console.log(`  → ${pass ? 'PASS' : 'FAIL'}: ${problems.join('; ') || 'all checks green'}`)
  }
  return { pass, problems, turns }
}

async function main() {
  const { scenario, showTranscript } = parseArgs()
  const list = scenario ? SCENARIOS.filter(s => s.key === scenario) : SCENARIOS
  if (!list.length) throw new Error(`Unknown scenario "${scenario}" — use: ${SCENARIOS.map(s => s.key).join(', ')}`)

  console.log(`Aisha Realtor Script Lab — ${list.length} scenario(s) on gpt-oss (Ultravox-model-family proxy)\n`)
  let passed = 0
  for (const sc of list) {
    const res = await runScenario(sc, showTranscript)
    if (res.pass) passed++
    console.log(`[${res.pass ? 'PASS' : 'FAIL'}] ${sc.key} (${res.turns} turns)${res.problems.length ? ' — ' + res.problems.join('; ') : ''}`)
  }
  console.log(`\n${passed}/${list.length} scenarios passed`)
  process.exit(passed === list.length ? 0 : 1)
}

main().catch(err => {
  console.error('script-lab failed:', err)
  process.exit(1)
})
