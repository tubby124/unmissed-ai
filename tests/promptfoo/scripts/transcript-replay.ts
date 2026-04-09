/**
 * Transcript replay harness — multi-turn offline conversation runner.
 *
 * Feeds scripted caller turns into a chat model with the generated system prompt
 * and records the agent's response + a per-case LLM-as-judge rubric score.
 * Used for Phase D.5 long-horizon drift cases (5 cases × 8-12 turns per niche).
 *
 * Why not promptfoo: promptfoo is single-turn by default. Multi-turn conversation
 * state would need a custom provider. For Phase D.5 we use this lightweight runner
 * and keep single-turn happy/edge/adversarial cases in the YAML files.
 *
 * Model:
 *   - Uses OpenRouter (openrouter.ai) with anthropic/claude-haiku-4.5 as the
 *     runtime model — same provider as the existing promptfoo tests for
 *     consistency. Ultravox text-only inference was researched (2026-04-09,
 *     Sonar Pro notebook 8d82f254): UserTextMessage requires an active call
 *     session, so pure offline text injection is not possible. Haiku via
 *     OpenRouter is the vault-spec'd fallback. Directionally correct but
 *     cadence may differ from Llama 3.3 70B Ultravox production.
 *
 * Usage:
 *   npx tsx tests/promptfoo/scripts/transcript-replay.ts --niche voicemail-generic
 *   npx tsx tests/promptfoo/scripts/transcript-replay.ts --niche auto-glass
 *   npx tsx tests/promptfoo/scripts/transcript-replay.ts --niche all
 *
 * Exit 0 if all cases rate ≥4.0 average on brand/task/emotion rubric, else exit 1.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// ── Config ───────────────────────────────────────────────────────────────────

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const MODEL = 'anthropic/claude-haiku-4.5'
const JUDGE_THRESHOLD = 4.0

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is not set. Export it or source ~/.secrets.')
  process.exit(2)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DriftCase {
  id: string
  name: string
  turns: Array<{ turn: number; caller: string }>
  rubric: string
}

interface DriftFile {
  niche: string
  prompt_fixture: string
  description: string
  cases: DriftCase[]
}

interface TurnResult {
  turn: number
  caller: string
  agent: string
}

interface CaseResult {
  id: string
  name: string
  turns: TurnResult[]
  rubric_scores: { brand: number; task: number; emotion: number; reason: string }
  average: number
  pass: boolean
}

// ── OpenRouter chat call ─────────────────────────────────────────────────────

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
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`OpenRouter returned no content: ${JSON.stringify(data).slice(0, 400)}`)
  return content.trim()
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runCase(systemPrompt: string, testCase: DriftCase): Promise<CaseResult> {
  const history: ChatMessage[] = [{ role: 'system', content: systemPrompt }]
  const turnResults: TurnResult[] = []

  for (const t of testCase.turns) {
    history.push({ role: 'user', content: t.caller })
    const agentResponse = await chat(history, 300, 0)
    history.push({ role: 'assistant', content: agentResponse })
    turnResults.push({ turn: t.turn, caller: t.caller, agent: agentResponse })
  }

  // LLM-as-judge — feed the full transcript + rubric to a judge model
  const transcriptText = turnResults
    .map((t) => `TURN ${t.turn}\nCaller: ${t.caller}\nAgent: ${t.agent}`)
    .join('\n\n')

  const judgePrompt = `You are a strict rubric judge evaluating a voice-agent conversation.

RUBRIC FOR THIS CASE:
${testCase.rubric}

FULL TRANSCRIPT:
${transcriptText}

Rate the agent on a 1-5 scale for each dimension:
- brand: consistency with the agent's identity and niche language
- task: did the agent successfully execute the task goal described in the rubric
- emotion: appropriate tonal match across the whole conversation

Return ONLY a single-line JSON object, no markdown, no prose:
{"brand": N, "task": N, "emotion": N, "reason": "<1-2 sentence justification>"}`

  const judgeResponse = await chat(
    [{ role: 'user', content: judgePrompt }],
    400,
    0,
  )

  // Extract JSON from judge (may be wrapped in code block)
  const jsonMatch = judgeResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Judge did not return JSON:\n${judgeResponse.slice(0, 500)}`)
  }
  const parsed = JSON.parse(jsonMatch[0]) as { brand: number; task: number; emotion: number; reason: string }
  const average = (parsed.brand + parsed.task + parsed.emotion) / 3

  return {
    id: testCase.id,
    name: testCase.name,
    turns: turnResults,
    rubric_scores: parsed,
    average,
    pass: average >= JUDGE_THRESHOLD,
  }
}

async function runNiche(nicheSlug: string): Promise<{ pass: number; fail: number; results: CaseResult[] }> {
  const driftFile = join(__dirname, '..', 'drift-cases', `${nicheSlug}.json`)
  const driftData: DriftFile = JSON.parse(readFileSync(driftFile, 'utf-8'))
  const promptPath = join(__dirname, '..', '..', '..', driftData.prompt_fixture)
  const systemPrompt = readFileSync(promptPath, 'utf-8')

  console.log(`\n═══ ${driftData.niche.toUpperCase()} — Long-horizon drift tests ═══`)
  console.log(`prompt: ${driftData.prompt_fixture} (${systemPrompt.length} chars)`)
  console.log(`cases: ${driftData.cases.length}\n`)

  const results: CaseResult[] = []
  let pass = 0
  let fail = 0

  for (const c of driftData.cases) {
    const startedAt = Date.now()
    process.stdout.write(`  ${c.id} ${c.name}...`)
    try {
      const result = await runCase(systemPrompt, c)
      results.push(result)
      if (result.pass) {
        pass += 1
        console.log(
          ` ✅ avg ${result.average.toFixed(2)} (brand ${result.rubric_scores.brand} / task ${result.rubric_scores.task} / emotion ${result.rubric_scores.emotion}) [${Date.now() - startedAt}ms]`,
        )
      } else {
        fail += 1
        console.log(
          ` ❌ avg ${result.average.toFixed(2)} (brand ${result.rubric_scores.brand} / task ${result.rubric_scores.task} / emotion ${result.rubric_scores.emotion})`,
        )
        console.log(`     reason: ${result.rubric_scores.reason}`)
      }
    } catch (err) {
      fail += 1
      console.log(` 💥 error: ${(err as Error).message.slice(0, 200)}`)
    }
  }

  return { pass, fail, results }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const nicheArg = args[args.indexOf('--niche') + 1] || 'all'
  const niches = nicheArg === 'all' ? ['voicemail-generic', 'auto-glass'] : [nicheArg]

  let totalPass = 0
  let totalFail = 0

  for (const niche of niches) {
    const { pass, fail } = await runNiche(niche)
    totalPass += pass
    totalFail += fail
  }

  console.log(`\n═══ SUMMARY ═══`)
  console.log(`  ${totalPass} pass / ${totalFail} fail`)
  console.log(`  threshold: brand+task+emotion average ≥ ${JUDGE_THRESHOLD}`)

  if (totalFail > 0) process.exit(1)
  process.exit(0)
}

main().catch((err) => {
  console.error('💥 transcript-replay fatal:', err)
  process.exit(1)
})
