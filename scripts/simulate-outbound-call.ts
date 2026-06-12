/**
 * scripts/simulate-outbound-call.ts
 *
 * Text-mode simulated-user test for OUTBOUND qualification prompts.
 * Assembles the real prompt via assembleOutboundPrompt(), resolves lead
 * placeholders, then plays a multi-turn conversation between the agent
 * (Groq llama-3.3-70b — Tier-1 canonical proxy of GLM-4.6 per repo rules;
 * gpt-oss-120b returns empty content in plain chat mode, reasoning eats
 * the budget) and a simulated lead persona (also llama-3.3-70b).
 *
 * Usage:
 *   GROQ_API_KEY=... npx tsx scripts/simulate-outbound-call.ts \
 *     --fields clients/hasan-sharif/outbound-lead-qual.json [--persona hot|skeptic|wrong|busy] [--turns 14]
 *
 * Prints the transcript; exit code 0 always (scoring is human/Claude review).
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { assembleOutboundPrompt, type OutboundPromptFields } from '../src/lib/outbound-prompt-builder'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const AGENT_MODEL = 'llama-3.3-70b-versatile'
const LEAD_MODEL = 'llama-3.3-70b-versatile'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

const PERSONAS: Record<string, { lead: { name: string; notes: string }; system: string }> = {
  hot: {
    lead: {
      name: 'Sarah',
      notes:
        'Form: get-the-list-calgary. City: Calgary. Budget band: $500K–$700K. Requested the Calgary home list.',
    },
    system:
      "You are Sarah, 31, on the phone. You JUST signed up for a Calgary home list on hasansharif.ca 2 minutes ago. You're renting in Taradale (NE Calgary), expecting a second kid, pre-approved with TD for $650K, want to buy within a month, not working with any agent. You're friendly but busy making dinner. Speak in short, natural spoken-English phone replies (5-20 words), sometimes with filler words. Answer questions honestly but only what's asked. If the caller sounds robotic or salesy, get a bit short with them. You're open to booking a call with Hasan tomorrow evening. Output ONLY your spoken words.",
  },
  skeptic: {
    lead: {
      name: 'Mike',
      notes: 'Form: get-the-list-calgary. City: Calgary. Budget band: not given. Requested the Calgary home list.',
    },
    system:
      "You are Mike, 45, on the phone. You signed up for a Calgary home list out of curiosity 5 minutes ago. You're suspicious of sales calls and immediately ask 'wait, is this a robot?' early in the call. You're 'just browsing', no lender yet, maybe buying next year, not working with an agent. If the caller is honest and chill about being an AI and doesn't push, you warm up slightly but decline booking — you'd rather just get emails. If they pressure you, you hang up (say '[hangs up]'). Short spoken replies only (3-15 words).",
  },
  wrong: {
    lead: { name: 'Dave', notes: 'Form: contact. City: Calgary. Message: (none)' },
    system:
      "You are Dave. You did NOT sign up for anything — someone typo'd their number. You're mildly annoyed. Say 'I think you got the wrong number, man' early. If they apologize and end quickly, say 'no worries'. If they keep talking, get angrier. Short spoken replies only (3-12 words).",
  },
  busy: {
    lead: {
      name: 'Amina',
      notes: 'Form: get-the-list-calgary. City: Calgary. Budget band: under $500K. Requested the Calgary home list.',
    },
    system:
      "You are Amina, 28, at work, whispering. You did sign up for the Calgary list 10 minutes ago and ARE seriously looking (new to Calgary, family wants to be near a mosque and good schools in the NE). But right now you're busy — say 'I can't really talk right now' early. If they offer a callback time, accept 'after 6 works'. Short spoken replies (3-15 words).",
  },
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string, dflt: string) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt
  }
  return {
    fields: get('--fields', 'clients/hasan-sharif/outbound-lead-qual.json'),
    persona: get('--persona', 'hot'),
    turns: Number(get('--turns', '14')),
  }
}

async function groq(model: string, messages: Msg[], maxTokens = 120): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.8 }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`Groq ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return (json.choices?.[0]?.message?.content ?? '').trim()
  }
  throw new Error('Groq rate-limited after retries')
}

async function main() {
  const { fields: fieldsPath, persona: personaKey, turns } = parseArgs()
  const persona = PERSONAS[personaKey]
  if (!persona) throw new Error(`Unknown persona "${personaKey}" — use: ${Object.keys(PERSONAS).join(', ')}`)

  const fields = JSON.parse(readFileSync(resolve(fieldsPath), 'utf8')) as OutboundPromptFields & {
    _comment?: string
  }
  const assembled = assembleOutboundPrompt({
    goal: fields.goal,
    tone: fields.tone,
    opening: fields.opening,
    vmScript: fields.vmScript,
    callNotes: fields.callNotes ?? null,
    specialInstructions: fields.specialInstructions ?? null,
  })

  const resolved = assembled
    .replace(/\{\{LEAD_NAME\}\}/g, persona.lead.name)
    .replace(/\{\{LEAD_PHONE\}\}/g, '+14035550123')
    .replace(/\{\{LEAD_NOTES\}\}/g, persona.lead.notes)
    .replace(/\{\{BUSINESS_NAME\}\}/g, 'Hasan Sharif')
    .replace(/\{\{AGENT_NAME\}\}/g, 'Aisha')

  const agentSystem =
    resolved +
    '\n\n[SIMULATION NOTE: This is a text simulation of a phone call. When you would invoke the hangUp tool, output exactly "[hangUp]" at the end of your final line instead.]'

  console.log(`\n=== SIMULATION persona=${personaKey} | agent=${AGENT_MODEL} | lead=${LEAD_MODEL} ===`)
  console.log(`(prompt ${resolved.length} chars)\n`)

  const agentMsgs: Msg[] = [{ role: 'system', content: agentSystem }]
  const leadMsgs: Msg[] = [{ role: 'system', content: persona.system }]

  // The lead answers the phone first.
  let leadLine = 'Hello?'
  console.log(`LEAD : ${leadLine}`)

  for (let t = 0; t < turns; t++) {
    agentMsgs.push({ role: 'user', content: leadLine })
    const agentLine = await groq(AGENT_MODEL, agentMsgs, 150)
    agentMsgs.push({ role: 'assistant', content: agentLine })
    console.log(`AISHA: ${agentLine}`)
    if (agentLine.includes('[hangUp]')) {
      console.log('\n--- call ended by agent ---')
      break
    }

    leadMsgs.push({ role: 'user', content: agentLine.replace('[hangUp]', '') })
    leadLine = await groq(LEAD_MODEL, leadMsgs, 80)
    leadMsgs.push({ role: 'assistant', content: leadLine })
    console.log(`LEAD : ${leadLine}`)
    if (/\[hangs up\]/i.test(leadLine)) {
      console.log('\n--- call ended by lead ---')
      break
    }
  }
  console.log('\n=== END ===\n')
}

main().catch(err => {
  console.error('simulate-outbound-call failed:', err)
  process.exit(1)
})
