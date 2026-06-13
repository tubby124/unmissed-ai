/**
 * scripts/simulate-inbound-listing.ts
 *
 * Text-mode simulated-caller test for the INBOUND prompt's LISTING FLOW
 * (Tier-1 proxy per repo test-tier rules — Groq llama-3.3-70b stands in for
 * GLM-4.6). Loads clients/{slug}/SYSTEM_PROMPT.txt, resolves {{callerContext}}
 * with a synthetic block, and stubs lookupListing / transitionToBookingStage /
 * sendTextMessage / queryKnowledge with the same response shapes the real
 * webhook routes return (incl. _instruction fields).
 *
 * Personas:
 *   specific — buyer calling about one exact listing (lookup → 1 match → showing)
 *   vague    — drove past a sign, only knows the street (lookup → 3 matches)
 *   sold     — asks about a listing that's gone (lookup → 0 matches)
 *   personal — friend of Hasan, CALL PATH: forwarded missed call (no lookup expected)
 *
 * Usage:
 *   GROQ_API_KEY=... npx tsx scripts/simulate-inbound-listing.ts \
 *     [--persona specific|vague|sold|personal] [--turns 14]
 *
 * Prints the transcript; exit code 0 always (scoring is human/Claude review).
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const AGENT_MODEL = 'llama-3.3-70b-versatile'
const CALLER_MODEL = 'llama-3.3-70b-versatile'

type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type Msg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

const PERSONAS: Record<string, { lookup: 'match' | 'multi' | 'none'; forwarded: boolean; system: string }> = {
  specific: {
    lookup: 'match',
    forwarded: false,
    system:
      "You are Priya, 34, calling a realtor's number you found on hasansharif.ca. You're asking about 47 Saddlebrook Way Northeast in Calgary — you want to know if it's still available and what it's listed at. You're pre-approved and serious. If it's available, you want to see it — Saturday around 2 PM works. Give your name when asked. Short natural spoken phone replies (4-18 words). Output ONLY your spoken words.",
  },
  vague: {
    lookup: 'multi',
    forwarded: false,
    system:
      "You are Marcus, 41. You drove past a for-sale sign in Taradale (NE Calgary) and called the number. You do NOT remember the exact address — 'somewhere on Taradale Drive, corner house I think'. When the assistant reads address options, pick 123 Taradale Drive. You're curious about price, not ready to book a showing — ask them to text you the link instead. Short spoken replies (3-15 words). Output ONLY spoken words.",
  },
  sold: {
    lookup: 'none',
    forwarded: false,
    system:
      "You are Jen, 29. You saved a listing weeks ago — 88 Whitehorn Road Northeast, Calgary — and are calling to ask about it. When told it's not in active listings or may have sold, you're disappointed but open: say yes to having an agent follow up with similar homes, give your name ('Jen Coulter'), budget around $500K if asked. Short spoken replies (3-15 words). Output ONLY spoken words.",
  },
  personal: {
    lookup: 'none',
    forwarded: true,
    system:
      "You are Omar, Hasan's friend from the gym. You called Hasan's personal cell and got his assistant instead. You just want Hasan to call you back about Friday. Identify yourself as 'Omar, his buddy from the gym'. You are NOT calling about real estate. Short spoken replies (3-12 words). Output ONLY spoken words.",
  },
}

const SIM_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'lookupListing',
      description:
        'Look up a property listing by street address fragment or MLS number. Use the moment a caller mentions a specific property, an address, a for-sale sign, or asks whether a listing is still available. Returns matching listings with address, price, beds/baths, availability, and a link.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Street address fragment or MLS number, as close to what the caller said as possible" },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'transitionToBookingStage',
      description:
        'Hand the call to the booking assistant once you have the caller name, service type (e.g. showing at an address), and a day/time preference.',
      parameters: {
        type: 'object',
        properties: {
          callerPhone: { type: 'string' },
          callerName: { type: 'string' },
          serviceType: { type: 'string' },
        },
        required: ['callerPhone', 'callerName', 'serviceType'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendTextMessage',
      description: 'Send an SMS text message to the caller during the call.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: "Caller's phone number in E.164 format from CALLER PHONE" },
          message: { type: 'string', description: 'SMS message body' },
        },
        required: ['to', 'message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'queryKnowledge',
      description: 'Search the business knowledge base for detailed information about services and programs.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
]

/** Mirrors /api/webhook/[slug]/listing-lookup response shapes exactly. */
function simListingBackend(scenario: 'match' | 'multi' | 'none'): string {
  if (scenario === 'match') {
    return JSON.stringify({
      matches: [{
        address: '47 Saddlebrook Way NE', city: 'Calgary', price: '$589,900',
        beds: 4, baths: 3, type: 'Detached', status: 'on the market',
        url: 'https://hasansharif.ca/listings/47-saddlebrook-way-ne',
      }],
      _instruction: 'One match. Confirm the street address back to the caller, tell them it is still on the market, share the asking price if they ask, then offer to set up a showing.',
    })
  }
  if (scenario === 'multi') {
    return JSON.stringify({
      matches: [
        { address: '123 Taradale Drive NE', city: 'Calgary', price: '$549,900', beds: 3, baths: 2, type: 'Detached', status: 'on the market', url: 'https://hasansharif.ca/listings/123-taradale-drive-ne' },
        { address: '87 Taradale Close NE', city: 'Calgary', price: '$612,000', beds: 4, baths: 3, type: 'Detached', status: 'on the market', url: 'https://hasansharif.ca/listings/87-taradale-close-ne' },
        { address: '240 Taravista Street NE', city: 'Calgary', price: '$575,000', beds: 3, baths: 3, type: 'Detached', status: 'on the market', url: 'https://hasansharif.ca/listings/240-taravista-street-ne' },
      ],
      _instruction: 'Multiple possible matches. Read just the street addresses back and ask the caller which one they mean. Then confirm that one and offer a showing.',
    })
  }
  return JSON.stringify({
    matches: [],
    _instruction: 'No active listing matched. It may have just sold, or the address was misheard — ask the caller to spell the street name or give the MLS number. If still nothing, say it might have sold and offer to have an agent follow up with similar listings. Collect their name.',
  })
}

function simToolBackend(scenario: 'match' | 'multi' | 'none', name: string, args: Record<string, string | undefined>): string {
  if (name === 'lookupListing') return simListingBackend(scenario)
  if (name === 'transitionToBookingStage') {
    return JSON.stringify({
      transitioned: true,
      _instruction: 'The booking assistant is taking over to confirm the slot. Tell the caller to hang tight one sec — say nothing else.',
    })
  }
  if (name === 'sendTextMessage') {
    return JSON.stringify({ sent: true, _instruction: 'Text sent. Confirm casually that you just texted them the link, then continue.' })
  }
  if (name === 'queryKnowledge') {
    return JSON.stringify({ results: [], _instruction: 'No results. Say you will have Hasan follow up on that.' })
  }
  return JSON.stringify({ error: `unknown tool ${name}` })
}

async function groq(model: string, messages: Msg[], maxTokens = 120, tools?: typeof SIM_TOOLS): Promise<{ content: string; tool_calls?: ToolCall[] }> {
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
    if (!res.ok) {
      const errBody = await res.text()
      // llama tool-call formatting flake — the model TRIED to call a tool but
      // malformed it (mixed speech + call). Retry; temperature usually clears it.
      if (res.status === 400 && errBody.includes('tool_use_failed')) {
        console.log(`  (tool_use_failed flake — retry ${attempt + 1}/3)`)
        continue
      }
      throw new Error(`Groq ${model} HTTP ${res.status}: ${errBody.slice(0, 200)}`)
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] }
    const msg = json.choices?.[0]?.message
    return { content: (msg?.content ?? '').trim(), tool_calls: msg?.tool_calls }
  }
  throw new Error('Groq rate-limited after retries')
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string, dflt: string) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt
  }
  return {
    persona: get('--persona', 'specific'),
    turns: Number(get('--turns', '14')),
    promptPath: get('--prompt', 'clients/hasan-sharif/SYSTEM_PROMPT.txt'),
  }
}

async function main() {
  const { persona: personaKey, turns, promptPath } = parseArgs()
  const persona = PERSONAS[personaKey]
  if (!persona) throw new Error(`Unknown persona "${personaKey}" — use: ${Object.keys(PERSONAS).join(', ')}`)

  const basePrompt = readFileSync(resolve(promptPath), 'utf8')

  const now = new Date()
  let callerContext =
    `TODAY: ${now.toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' })} (${now.toLocaleDateString('en-US', { timeZone: 'America/Edmonton', weekday: 'long' })})\n` +
    `CURRENT TIME: ${now.toLocaleTimeString('en-US', { timeZone: 'America/Edmonton', hour: 'numeric', minute: '2-digit', hour12: true })} (America/Edmonton)\n` +
    `CALLER PHONE: +14035556677`
  if (persona.forwarded) {
    callerContext += `\nCALL PATH: forwarded missed call — the caller dialed the owner's personal number (+13068507687) and was forwarded here.`
  }

  const agentSystem = basePrompt.replace(/\{\{callerContext\}\}/g, `[${callerContext}]`) +
    '\n\n[SIMULATION NOTE: This is a text simulation of a phone call. When you would invoke the hangUp tool, output exactly "[hangUp]" at the end of your final line instead.]'

  console.log(`\n=== INBOUND SIM persona=${personaKey} lookup=${persona.lookup} forwarded=${persona.forwarded} | agent=${AGENT_MODEL} ===`)
  console.log(`(prompt ${agentSystem.length} chars)\n`)

  const agentMsgs: Msg[] = [{ role: 'system', content: agentSystem }]
  const callerMsgs: Msg[] = [{ role: 'system', content: persona.system }]

  // Inbound: the agent greets first.
  let callerLine = '[SIMULATION: The call just connected. The caller has not spoken yet. Give your opening greeting.]'

  for (let t = 0; t < turns; t++) {
    agentMsgs.push({ role: 'user', content: callerLine })

    let agentLine = ''
    let transitioned = false
    for (let hop = 0; hop < 4; hop++) {
      const out = await groq(AGENT_MODEL, agentMsgs, 200, SIM_TOOLS)
      if (out.tool_calls?.length) {
        agentMsgs.push({ role: 'assistant', content: out.content || null, tool_calls: out.tool_calls })
        for (const tc of out.tool_calls) {
          let args: Record<string, string | undefined> = {}
          try { args = JSON.parse(tc.function.arguments) } catch { /* leave empty */ }
          const result = simToolBackend(persona.lookup, tc.function.name, args)
          console.log(`TOOL : ${tc.function.name}(${tc.function.arguments}) → ${result.slice(0, 160)}`)
          agentMsgs.push({ role: 'tool', content: result, tool_call_id: tc.id })
          if (tc.function.name === 'transitionToBookingStage') transitioned = true
        }
        continue
      }
      agentLine = out.content
      break
    }
    agentMsgs.push({ role: 'assistant', content: agentLine })
    console.log(`AISHA : ${agentLine}`)
    if (transitioned) {
      console.log('\n--- transitioned to booking stage (SUCCESS — booking assistant takes over) ---')
      break
    }
    if (agentLine.includes('[hangUp]')) {
      console.log('\n--- call ended by agent ---')
      break
    }

    callerMsgs.push({ role: 'user', content: agentLine.replace('[hangUp]', '') })
    const callerOut = await groq(CALLER_MODEL, callerMsgs, 80)
    callerLine = callerOut.content
    callerMsgs.push({ role: 'assistant', content: callerLine })
    console.log(`CALLER: ${callerLine}`)
    if (/\[hangs up\]/i.test(callerLine)) {
      console.log('\n--- call ended by caller ---')
      break
    }
  }
  console.log('\n=== END ===\n')
}

main().catch(err => {
  console.error('simulate-inbound-listing failed:', err)
  process.exit(1)
})
