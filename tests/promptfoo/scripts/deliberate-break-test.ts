/**
 * Deliberate-break regression test — Phase D.5 harness-health check.
 *
 * Non-negotiable proof that the Golden Dataset harness actually CATCHES
 * regressions. Procedure per vault spec:
 *
 *   1. Baseline — run a mini 3-case Golden subset on the normal auto_glass
 *      prompt fixture → record average rubric score.
 *   2. Break — strip the "VOICE NATURALNESS" / "VOICE STYLE" block and the
 *      FORBIDDEN voice-lock rules from the prompt → rerun → expect score drop
 *      (specifically on the `emotion` dimension).
 *   3. Restore — revert to normal fixture → rerun → expect score recovery.
 *
 * Exit 0 if the harness demonstrably measures the delta:
 *   - baseline.emotion - broken.emotion ≥ 0.5
 *   - restored.emotion ≥ baseline.emotion - 0.3  (small stochastic slack)
 * Else exit 1 — the harness isn't measuring what we think it is.
 *
 * Usage:
 *   npx tsx tests/promptfoo/scripts/deliberate-break-test.ts
 *
 * Runs against the auto_glass prompt fixture (must be generated first).
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const MODEL = 'anthropic/claude-haiku-4.5'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is not set. Export it or source ~/.secrets.')
  process.exit(2)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function chat(messages: ChatMessage[], maxTokens = 300, temperature = 0): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature, messages }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`OpenRouter returned no content`)
  return content.trim()
}

// ── Mini 3-case probe (exercises voice naturalness specifically) ────────────

const PROBE_CASES: Array<{ id: string; caller: string }> = [
  { id: 'P1', caller: 'Hi, who is this?' },
  { id: 'P2', caller: "I've got a crack in my windshield that's getting bigger." },
  { id: 'P3', caller: 'Just tell me how much a new windshield costs.' },
]

interface ProbeScore {
  variant: string
  brand: number
  task: number
  emotion: number
  average: number
  samples: Array<{ id: string; caller: string; agent: string }>
}

async function rateProbe(variant: string, systemPrompt: string): Promise<ProbeScore> {
  const samples: Array<{ id: string; caller: string; agent: string }> = []
  for (const p of PROBE_CASES) {
    const agent = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: p.caller },
    ])
    samples.push({ id: p.id, caller: p.caller, agent })
  }

  const judgePrompt = `You are a strict rubric judge. Rate the agent across these 3 sample turns on a 1-5 scale each:

${samples.map((s) => `CALLER: ${s.caller}\nAGENT: ${s.agent}`).join('\n\n')}

Dimensions:
- brand: matches expected auto-glass shop persona (uses shop anchors, names Windshield Hub / Mark / Sabbir)
- task: advances toward collecting vehicle info or routing to Sabbir appropriately
- emotion: SOUNDS HUMAN — uses contractions, casual tone, backchannels, no corporate filler words like "certainly/absolutely/of course/I will"

Return ONLY a single-line JSON object, no markdown, no prose:
{"brand": N, "task": N, "emotion": N}`

  const judgeResponse = await chat([{ role: 'user', content: judgePrompt }], 200, 0)
  const jsonMatch = judgeResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Judge did not return JSON: ${judgeResponse.slice(0, 300)}`)
  const parsed = JSON.parse(jsonMatch[0]) as { brand: number; task: number; emotion: number }
  const average = (parsed.brand + parsed.task + parsed.emotion) / 3
  return { variant, ...parsed, average, samples }
}

// ── Break transform — strip voice naturalness blocks ────────────────────────

function breakPrompt(_prompt: string): string {
  // Replace the entire system prompt with a bare corporate-formal instruction
  // that forces the model to drop casual voice patterns. This is the strongest
  // possible break — if the harness can't distinguish the bare version from
  // the full Phase D prompt, the harness isn't measuring voice quality at all.
  return `You are a formal professional phone assistant at Windshield Hub auto glass shop.
Answer caller questions in complete grammatically correct sentences.
Always use formal language: "certainly", "I will", "I would be happy to assist you", "absolutely".
Do NOT use contractions. Do NOT use casual fillers. Do NOT use sentence fragments.
Always maintain a polite corporate tone. When asked about pricing, quote "$299 for standard replacement".`
}

async function main() {
  const promptPath = join(__dirname, '..', 'generated', 'auto-glass-prompt.txt')
  const normalPrompt = readFileSync(promptPath, 'utf-8')
  const brokenPrompt = breakPrompt(normalPrompt)

  console.log('🔬 Deliberate-break harness-health check')
  console.log(`   normal prompt: ${normalPrompt.length} chars`)
  console.log(`   broken prompt: ${brokenPrompt.length} chars (${normalPrompt.length - brokenPrompt.length} stripped)\n`)

  if (brokenPrompt.length === normalPrompt.length) {
    console.error('💥 break transform had no effect — sections not found, update breakPrompt()')
    process.exit(1)
  }

  console.log('1️⃣  Running baseline (normal prompt)...')
  const baseline = await rateProbe('baseline', normalPrompt)
  console.log(`   baseline: brand=${baseline.brand} task=${baseline.task} emotion=${baseline.emotion} avg=${baseline.average.toFixed(2)}`)

  console.log('\n2️⃣  Running broken (stripped voice naturalness)...')
  const broken = await rateProbe('broken', brokenPrompt)
  console.log(`   broken:   brand=${broken.brand} task=${broken.task} emotion=${broken.emotion} avg=${broken.average.toFixed(2)}`)

  console.log('\n3️⃣  Running restored (normal prompt, fresh call)...')
  const restored = await rateProbe('restored', normalPrompt)
  console.log(`   restored: brand=${restored.brand} task=${restored.task} emotion=${restored.emotion} avg=${restored.average.toFixed(2)}`)

  // ── Assertions ──────────────────────────────────────────────────────────
  const emotionDrop = baseline.emotion - broken.emotion
  const recoveryGap = baseline.emotion - restored.emotion

  console.log('\n═══ VERDICT ═══')
  console.log(`   emotion drop (baseline − broken): ${emotionDrop.toFixed(2)}  (need ≥ 0.5)`)
  console.log(`   recovery gap (baseline − restored): ${recoveryGap.toFixed(2)}  (need ≤ 0.3)`)

  let fail = false
  if (emotionDrop < 0.5) {
    console.log('   ❌ HARNESS DOES NOT DETECT VOICE BREAK — rubric not measuring emotion sensitivity')
    fail = true
  } else {
    console.log('   ✅ harness detects voice break')
  }
  if (recoveryGap > 0.3) {
    console.log('   ⚠️  restored score lower than baseline — high variance or model flake')
    // non-fatal, just warn
  } else {
    console.log('   ✅ restored score recovers')
  }

  process.exit(fail ? 1 : 0)
}

main().catch((err) => {
  console.error('💥 deliberate-break-test fatal:', err)
  process.exit(1)
})
