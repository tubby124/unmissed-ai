import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
}

describe('Learning Loop demo prompt regressions', () => {
  test('unmissed demo prompt handles off-topic/nonsense during booking without treating it as confirmation', () => {
    const prompt = read('clients/unmissed-demo/SYSTEM_PROMPT.txt')

    assert.match(prompt, /off-topic or nonsensical/i)
    assert.match(prompt, /sorry, didn't catch that/i)
    assert.match(prompt, /back to the booking/i)
    assert.match(prompt, /Do not treat nonsense as confirmation/i)
    assert.match(prompt, /Nonsense is not yes/i)
  })

  test('unmissed demo prompt requires exact day and time confirmation before bookAppointment', () => {
    const prompt = read('clients/unmissed-demo/SYSTEM_PROMPT.txt')
    const confirmIndex = prompt.indexOf('before booking, verbally confirm exact day + time')
    const bookIndex = prompt.indexOf('bookAppointment with date, time')

    assert.notEqual(confirmIndex, -1, 'missing exact day/time confirmation rule')
    assert.notEqual(bookIndex, -1, 'missing bookAppointment booking instruction')
    assert.ok(confirmIndex < bookIndex, 'confirmation rule must appear before bookAppointment instruction')
    assert.match(prompt, /so that's \[day\] at \[time\]/i)
    assert.match(prompt, /Wait for a clear yes/i)
  })

  test('booking stage route carries the same runtime guardrails', () => {
    const route = read('src/app/api/stages/[slug]/booking/route.ts')

    assert.match(route, /confirm the exact day \+ time/i)
    assert.match(route, /clear yes/i)
    assert.match(route, /Nonsense is not yes/i)
    assert.match(route, /off-topic/i)
    assert.match(route, /Do not treat nonsense as confirmation/i)
  })
})
