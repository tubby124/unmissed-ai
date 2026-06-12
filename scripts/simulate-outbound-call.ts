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
 * v5: simulates the calendar booking tools (checkCalendarAvailability +
 * bookAppointment) with stubbed backends so the BOOK IT FOR REAL close can
 * be exercised offline. --calendar controls the stub scenario:
 *   free     (default) — the lead's requested time is available
 *   conflict — requested time is taken; closest alternatives offered
 *   fail     — tools return fallback=true (verbal-lock fallback path)
 *   off      — no tools attached (legacy v4 behavior)
 *
 * Usage:
 *   GROQ_API_KEY=... npx tsx scripts/simulate-outbound-call.ts \
 *     --fields clients/hasan-sharif/outbound-lead-qual.json \
 *     [--persona hot|skeptic|wrong|busy|conflict] [--turns 14] [--calendar free|conflict|fail|off]
 *
 * Prints the transcript; exit code 0 always (scoring is human/Claude review).
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { assembleOutboundPrompt, type OutboundPromptFields } from '../src/lib/outbound-prompt-builder'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const AGENT_MODEL = 'llama-3.3-70b-versatile'
const LEAD_MODEL = 'llama-3.3-70b-versatile'

type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type Msg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

const PERSONAS: Record<string, { lead: { name: string; notes: string }; system: string }> = {
  hot: {
    lead: {
      name: 'Sarah',
      notes:
        'Form: get-the-list-calgary. City: Calgary. Budget band: $500K–$700K. Requested the Calgary home list.',
    },
    system:
      "You are Sarah, 31, on the phone. You JUST signed up for a Calgary home list on hasansharif.ca 2 minutes ago. You're renting in Taradale (NE Calgary), expecting a second kid, pre-approved with TD for $650K, want to buy within a month, not working with any agent. You're friendly but busy making dinner. Speak in short, natural spoken-English phone replies (5-20 words), sometimes with filler words. Answer questions honestly but only what's asked. If the caller sounds robotic or salesy, get a bit short with them. You're open to booking a call — if asked for a time, say 'tomorrow at 2 works'. Output ONLY your spoken words.",
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
  conflict: {
    lead: {
      name: 'Jordan',
      notes: 'Form: get-the-list-calgary. City: Calgary. Budget band: $600K–$750K. Requested the Calgary home list.',
    },
    system:
      "You are Jordan, 38, on the phone. You signed up for a Calgary home list 3 minutes ago. Relocating from Vancouver in 6 weeks for work, pre-approved at $720K, want SW Calgary, no agent yet. You're decisive. When asked for a meeting time, insist on 'tomorrow at 2 PM' specifically. If told 2 isn't available and offered a nearby time, accept the closest one after one beat ('hmm... yeah okay, that works'). Short natural spoken replies (5-18 words). Output ONLY spoken words.",
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
    calendar: get('--calendar', 'free') as 'free' | 'conflict' | 'fail' | 'off',
  }
}

// ── Stubbed calendar backend ─────────────────────────────────────────────────

const SIM_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'checkCalendarAvailability',
      description:
        'Check available appointment slots for a given date. Returns a slots array — each slot has a displayTime string (e.g. "9:00 AM"). If the caller asks for a specific day/time, pass BOTH date and time — never omit the time. When the exact requested time is available, confirm that exact day/time and do not offer alternatives.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Use the TODAY value from the context block to resolve relative dates like "tomorrow".' },
          time: { type: 'string', description: 'Preferred time in 24h HH:MM format (e.g. "14:00"). Omit if caller has no preference.' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bookAppointment',
      description:
        'Book an appointment only after verbally confirming the exact day/time and receiving a clear yes. Pass time exactly as the displayTime value returned by checkCalendarAvailability.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          time: { type: 'string', description: 'Exact displayTime from checkCalendarAvailability e.g. "2:00 PM"' },
          callerName: { type: 'string' },
          callerPhone: { type: 'string' },
          service: { type: 'string' },
        },
        required: ['date', 'time', 'callerName', 'callerPhone'],
      },
    },
  },
]

function fmt12h(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return hhmm
  let h = parseInt(m[1])
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  if (h > 12) h -= 12
  return `${h}:${m[2]} ${ampm}`
}

/** Mimics /api/calendar/[slug]/slots + /book responses closely enough to drive the prompt. */
function simCalendarBackend(
  scenario: 'free' | 'conflict' | 'fail',
  name: string,
  args: Record<string, string | undefined>,
): string {
  if (scenario === 'fail') {
    return JSON.stringify({
      available: false, booked: false, fallback: true, reason: 'calendar_auth_expired',
      _instruction: name === 'bookAppointment'
        ? `Booking failed — tell the caller you'll have someone follow up to confirm their appointment.`
        : `Calendar is unavailable right now. Lock the time verbally and say one of our agents will text to confirm.`,
    })
  }
  if (name === 'checkCalendarAvailability') {
    const t = args.time
    if (t && scenario === 'free') {
      const display = fmt12h(t)
      return JSON.stringify({
        available: true,
        slots: [{ displayTime: display }, { displayTime: '4:30 PM' }, { displayTime: '11:00 AM' }],
        _instruction: `The caller's requested time is available. Confirm the exact day and time back: "so that's ${display} — does that work?" Do not offer other options.`,
      })
    }
    if (t && scenario === 'conflict') {
      return JSON.stringify({
        available: true,
        slots: [{ displayTime: '2:30 PM' }, { displayTime: '1:30 PM' }, { displayTime: '4:00 PM' }],
        _instruction: `The caller requested ${t}, but that exact time is not available. Closest available slots: 2:30 PM, 1:30 PM, 4:00 PM. Offer the closest one and ask if it works. Do not say the requested time is booked unless explicitly told.`,
      })
    }
    return JSON.stringify({
      available: true,
      slots: [{ displayTime: '2:00 PM' }, { displayTime: '4:30 PM' }, { displayTime: '11:00 AM' }],
      _instruction: `Available slots: 2:00 PM, 4:30 PM, 11:00 AM. Read 2-3 options naturally — don't list all of them. Ask which works best.`,
    })
  }
  // bookAppointment
  if (scenario === 'conflict' && /2:00\s*PM/i.test(args.time ?? '')) {
    return JSON.stringify({
      booked: false, reason: 'slot_taken', nextAvailable: '2:30 PM',
      _instruction: 'That slot was just taken. Offer 2:30 PM instead and ask if that works.',
    })
  }
  return JSON.stringify({
    booked: true,
    confirmationTime: args.time,
    _instruction: `Booked for ${args.date} at ${args.time}. Confirm the date and time back to the caller and ask if there's anything else.`,
  })
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function groq(
  model: string,
  messages: Msg[],
  maxTokens = 120,
  tools?: typeof SIM_TOOLS,
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.8, ...(tools ? { tools } : {}) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`Groq ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] }
    const msg = json.choices?.[0]?.message
    return { content: (msg?.content ?? '').trim(), tool_calls: msg?.tool_calls }
  }
  throw new Error('Groq rate-limited after retries')
}

async function main() {
  const { fields: fieldsPath, persona: personaKey, turns, calendar } = parseArgs()
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

  // Mirror the runtime date block both dial paths append when booking-ready
  // (lib/outbound-call-assembly.ts buildOutboundDateBlock).
  const now = new Date()
  const dateBlock = calendar === 'off' ? '' :
    `\n\n[TODAY: ${now.toLocaleDateString('en-CA', { timeZone: 'America/Regina' })} (${now.toLocaleDateString('en-US', { timeZone: 'America/Regina', weekday: 'long' })})\nCURRENT TIME: ${now.toLocaleTimeString('en-US', { timeZone: 'America/Regina', hour: 'numeric', minute: '2-digit', hour12: true })} (America/Regina)\nCALLER PHONE: +14035550123]`

  const agentSystem =
    resolved + dateBlock +
    '\n\n[SIMULATION NOTE: This is a text simulation of a phone call. When you would invoke the hangUp tool, output exactly "[hangUp]" at the end of your final line instead.]'

  const simTools = calendar === 'off' ? undefined : SIM_TOOLS

  console.log(`\n=== SIMULATION persona=${personaKey} calendar=${calendar} | agent=${AGENT_MODEL} | lead=${LEAD_MODEL} ===`)
  console.log(`(prompt ${resolved.length} chars)\n`)

  const agentMsgs: Msg[] = [{ role: 'system', content: agentSystem }]
  const leadMsgs: Msg[] = [{ role: 'system', content: persona.system }]

  // The lead answers the phone first.
  let leadLine = 'Hello?'
  console.log(`LEAD : ${leadLine}`)

  for (let t = 0; t < turns; t++) {
    agentMsgs.push({ role: 'user', content: leadLine })

    // Agent turn — may chain tool calls before speaking (max 4 hops/turn).
    let agentLine = ''
    for (let hop = 0; hop < 4; hop++) {
      const out = await groq(AGENT_MODEL, agentMsgs, 200, simTools)
      if (out.tool_calls?.length && calendar !== 'off') {
        agentMsgs.push({ role: 'assistant', content: out.content || null, tool_calls: out.tool_calls })
        for (const tc of out.tool_calls) {
          let args: Record<string, string | undefined> = {}
          try { args = JSON.parse(tc.function.arguments) } catch { /* leave empty */ }
          const result = simCalendarBackend(calendar as 'free' | 'conflict' | 'fail', tc.function.name, args)
          console.log(`TOOL : ${tc.function.name}(${tc.function.arguments}) → ${result.slice(0, 140)}`)
          agentMsgs.push({ role: 'tool', content: result, tool_call_id: tc.id })
        }
        continue
      }
      agentLine = out.content
      break
    }
    agentMsgs.push({ role: 'assistant', content: agentLine })
    console.log(`AISHA: ${agentLine}`)
    if (agentLine.includes('[hangUp]')) {
      console.log('\n--- call ended by agent ---')
      break
    }

    leadMsgs.push({ role: 'user', content: agentLine.replace('[hangUp]', '') })
    const leadOut = await groq(LEAD_MODEL, leadMsgs, 80)
    leadLine = leadOut.content
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
