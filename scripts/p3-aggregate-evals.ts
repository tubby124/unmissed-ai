// Aggregate the 4 promptfoo eval JSONs into a single per-scenario × per-client table.
import * as fs from 'node:fs'

const CLIENTS = ['urban-vibe', 'exp-realty', 'hasan-sharif', 'velly-remodeling']
const UNIVERSAL_SCENARIOS = new Set([1, 2, 10, 11]) // Bug3, JUNK, injection, role-swap

interface Result { description: string; success: boolean; failureReason?: string }

function load(client: string): Result[] {
  const path = `/tmp/brian-audit/${client}-eval.json`
  const raw = JSON.parse(fs.readFileSync(path, 'utf-8'))
  const tests = raw.results?.results ?? raw.results ?? []
  return tests.map((t: any): Result => ({
    description: t.testCase?.description ?? t.description ?? '?',
    success: t.success === true || t.gradingResult?.pass === true,
    failureReason: t.gradingResult?.reason?.slice(0, 60) ?? t.error?.slice(0, 60),
  }))
}

const all = Object.fromEntries(CLIENTS.map(c => [c, load(c)]))
const scenarioCount = all[CLIENTS[0]].length

console.log('Scenario | Description (truncated) | universal? | ' + CLIENTS.join(' | '))
console.log('-'.repeat(140))
for (let i = 0; i < scenarioCount; i++) {
  const universal = UNIVERSAL_SCENARIOS.has(i + 1) ? 'YES' : '   '
  const desc = (all[CLIENTS[0]][i]?.description ?? '?').slice(0, 55).padEnd(55)
  const marks = CLIENTS.map(c => (all[c][i]?.success ? '   ✓    ' : '   ✗    ')).join(' | ')
  console.log(`  ${String(i + 1).padStart(2)}     | ${desc} |    ${universal}     | ${marks}`)
}
console.log('-'.repeat(140))

for (const c of CLIENTS) {
  const total = all[c].length
  const passed = all[c].filter(r => r.success).length
  const universal_pass = all[c].filter((_, i) => UNIVERSAL_SCENARIOS.has(i + 1)).filter(r => r.success).length
  const universal_total = UNIVERSAL_SCENARIOS.size
  console.log(`${c.padEnd(18)} : ${passed}/${total} overall (${((passed/total)*100).toFixed(1)}%) · universal-only: ${universal_pass}/${universal_total} (${((universal_pass/universal_total)*100).toFixed(0)}%)`)
}

console.log('')
console.log('Bug 3 (scenario 1) outcomes per client:')
for (const c of CLIENTS) {
  const r = all[c][0]
  console.log(`  ${c.padEnd(18)} : ${r?.success ? 'PASS' : 'FAIL'} - ${r?.failureReason ?? ''}`)
}
