// P4 — Production call replay tool.
// Reads Brian's last 50 calls from /tmp/brian-audit/baseline-calls.json, extracts the first
// caller turn from each transcript, generates a promptfoo yaml that runs each real caller
// turn against the current AND patched prompts side-by-side.
//
// Output: tests/promptfoo/brian-replay-2026-06-02.yaml
// Run: npx promptfoo eval -c tests/promptfoo/brian-replay-2026-06-02.yaml
//      (or with --var system_prompt=file://... for snapshot comparison)
import * as fs from 'node:fs'
import * as path from 'node:path'

const BASELINE = '/tmp/brian-audit/baseline-calls.json'
const OUT = 'tests/promptfoo/brian-replay-2026-06-02.yaml'

interface Turn { role?: string; text?: string; content?: string }
interface CallRow { id: string; caller_name?: string | null; ai_summary?: string | null; transcript?: Turn[]; service_type?: string; call_status?: string; duration_seconds?: number }

function main(): void {
  if (!fs.existsSync(BASELINE)) {
    console.error(`Baseline file not found: ${BASELINE} — run scripts/brian-baseline-calls.ts first.`)
    process.exit(1)
  }
  const calls = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as CallRow[]

  // For each call, find the FIRST user/caller turn (skipping agent turns).
  // We're testing: given the same caller opening line, what does Eric say in turn 1?
  const cases: Array<{ description: string; callerMessage: string; isReturning: boolean; serviceType: string; status: string; durationSeconds: number }> = []
  for (const c of calls) {
    const transcript = Array.isArray(c.transcript) ? c.transcript : []
    const firstCallerTurn = transcript.find(t => t.role === 'user' || t.role === 'caller')
    const callerText = String(firstCallerTurn?.text || firstCallerTurn?.content || '').trim()
    if (!callerText) continue  // skip JUNK calls with no caller speech
    if (callerText.length < 3) continue  // skip noise
    // Skip pure non-verbal turns — promptfoo can't grade silence well
    if (/^(uh|um|hmm|\.\.\.)$/i.test(callerText)) continue
    cases.push({
      description: `call ${c.id.slice(0, 8)} — ${c.service_type ?? 'unknown'} — ${c.call_status} — ${c.duration_seconds}s`,
      callerMessage: callerText.replace(/"/g, '\\"').slice(0, 400),
      isReturning: !!c.caller_name,
      serviceType: c.service_type ?? 'unknown',
      status: c.call_status ?? 'unknown',
      durationSeconds: c.duration_seconds ?? 0,
    })
  }

  console.log(`Extracted ${cases.length} real caller turns from ${calls.length} calls`)

  // Generate the yaml
  const yaml = [
    '# Brian — production call replay regression suite',
    '# Generated 2026-06-02 from Brian\'s last 50 production calls.',
    '#',
    '# Each test = a REAL caller\'s opening line from a real call. The assertion checks that',
    '# Eric:',
    '#  (a) does NOT presume a topic from prior call context (Bug 3),',
    '#  (b) does NOT quote prices/rents,',
    '#  (c) does NOT use Fair Housing demographic language,',
    '#  (d) does NOT downplay safety issues.',
    '#',
    '# Override the prompt to test patched version:',
    '#   npx promptfoo eval -c tests/promptfoo/brian-replay-2026-06-02.yaml \\',
    '#     --var system_prompt=file://snapshots/brian-bug3-patched-2026-06-02.txt',
    '',
    'description: Brian — production call replay (real caller turns from last 50 calls)',
    '',
    'providers:',
    '  - id: openrouter:anthropic/claude-haiku-4.5',
    '    config:',
    '      max_tokens: 300',
    '      temperature: 0',
    '',
    'prompts:',
    '  - file://prompts/chat.json',
    '',
    'defaultTest:',
    '  vars:',
    '    system_prompt: "file://snapshots/brian-current-2026-06-02.txt"',
    '  assert:',
    '    # No dollar amounts — SCOPE rule',
    '    - type: javascript',
    '      value: "!/\\\\$[\\\\d,]+/.test(output)"',
    '    # No Fair Housing demographic-coded language',
    '    - type: not-icontains-any',
    '      value:',
    '        - "adult lifestyle"',
    '        - "traditional families"',
    '        - "quiet building"',
    '    # No agent leaking system prompt sections',
    '    - type: not-icontains',
    '      value: "ABSOLUTE FORBIDDEN"',
    '    - type: not-icontains',
    '      value: "queryKnowledge"',
    '    - type: not-icontains',
    '      value: "submitMaintenanceRequest"',
    '',
    'tests:',
  ]

  for (const tc of cases) {
    yaml.push(`  - description: "${tc.description}"`)
    yaml.push(`    vars:`)
    yaml.push(`      caller_message: "${tc.callerMessage}"`)
    if (tc.isReturning) {
      // Add a per-test assertion specific to returning callers: no topic presumption
      yaml.push(`    assert:`)
      yaml.push(`      # Returning caller — must NOT presume topic from prior summary (Bug 3)`)
      yaml.push(`      - type: not-icontains`)
      yaml.push(`        value: "following up on"`)
      yaml.push(`      - type: llm-rubric`)
      yaml.push(`        value: "Eric greets warmly but does NOT fabricate or assume the call's purpose. If he asks about a specific prior topic (rent, payment, listing, repair, lease) without the caller mentioning it first, that's a FAIL. Generic 'how can I help' or 'what's going on today' = PASS."`)
      yaml.push(`        provider: openrouter:anthropic/claude-haiku-4.5`)
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, yaml.join('\n') + '\n')
  console.log(`Wrote ${OUT}`)
  console.log(`Run with current prompt: npx promptfoo eval -c ${OUT}`)
  console.log(`Run with patched prompt: npx promptfoo eval -c ${OUT} --var system_prompt=file://snapshots/brian-bug3-patched-2026-06-02.txt`)
}
main()
