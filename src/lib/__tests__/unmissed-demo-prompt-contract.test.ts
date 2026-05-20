import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../..')
const promptPath = path.join(repoRoot, 'clients/unmissed-demo/SYSTEM_PROMPT.txt')
const testPromptPath = path.join(repoRoot, 'clients/unmissed-demo/SYSTEM_PROMPT_TEST.txt')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

describe('unmissed-demo Zara prompt contract', () => {
  const prompt = read(promptPath)
  const testPrompt = read(testPromptPath)

  it('keeps production and test prompt copies in sync', () => {
    assert.equal(testPrompt, prompt)
  })

  it('is compressed enough for live demo behavior', () => {
    assert.ok(prompt.length >= 6000, `prompt too short: ${prompt.length}`)
    assert.ok(prompt.length <= 7500, `prompt too long: ${prompt.length}`)
  })

  it('uses the approved pricing only', () => {
    assert.match(prompt, /\$119\/month/)
    assert.match(prompt, /250 minutes/)
    assert.match(prompt, /\$29\/month/)
    assert.match(prompt, /50 minutes/)
    assert.doesNotMatch(prompt, /\$20\b/)
    assert.doesNotMatch(prompt, /\$29 founding/i)
    assert.doesNotMatch(prompt, /\$49 regular/i)
  })

  it('keeps booking in triage-stage terms only', () => {
    assert.match(prompt, /transitionToBookingStage/)
    assert.doesNotMatch(prompt, /checkCalendarAvailability/)
    assert.doesNotMatch(prompt, /bookAppointment/)
  })

  it('requires truthful tool and notification claims', () => {
    assert.match(prompt, /sendTextMessage/)
    assert.match(prompt, /queryKnowledge/)
    assert.match(prompt, /Telegram depends on setup|Telegram when it is configured/)
    assert.doesNotMatch(prompt, /Telegram alert is live for this demo/i)
  })
})
