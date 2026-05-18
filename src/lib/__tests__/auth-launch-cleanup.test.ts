import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const launchAuthFiles = [
  'src/lib/activate-client.ts',
  'src/app/onboard/page.tsx',
  'src/components/onboard/TrialSuccessScreen.tsx',
  'src/app/login/page.tsx',
]

describe('launch auth cleanup', () => {
  test('onboarding and activation do not expose a shared temporary password', () => {
    for (const file of launchAuthFiles) {
      const source = readFileSync(join(ROOT, file), 'utf8')

      assert.equal(source.includes('QWERTY123'), false, `${file} must not reference the old shared password`)
      assert.equal(source.toLowerCase().includes('temporary password'), false, `${file} must not expose temporary password copy`)
    }
  })
})
