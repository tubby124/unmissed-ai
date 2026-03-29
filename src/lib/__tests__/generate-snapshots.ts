/**
 * generate-snapshots.ts — ONE-SHOT snapshot generator for prompt-builder golden tests.
 *
 * Run ONCE before any refactor to capture the exact current output:
 *   npx tsx src/lib/__tests__/generate-snapshots.ts
 *
 * The .txt files in snapshots/ are committed to git and compared verbatim during tests.
 * Do NOT re-run this after starting a refactor — doing so would overwrite the ground truth.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPromptFromIntake } from '../prompt-builder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOTS_DIR = join(__dirname, 'snapshots')

mkdirSync(SNAPSHOTS_DIR, { recursive: true })

function save(name: string, intake: Record<string, unknown>): void {
  const output = buildPromptFromIntake(intake)
  const path = join(SNAPSHOTS_DIR, `${name}.txt`)
  // Normalize line endings to LF so git diff is stable on all platforms
  writeFileSync(path, output.replace(/\r\n/g, '\n'), 'utf8')
  console.log(`✓ ${name}.txt  (${output.length} chars)`)
}

// ── 5 required stored snapshots ───────────────────────────────────────────────

save('hvac-baseline', {
  business_name: 'Prairie HVAC',
  agent_name: 'Alex',
  niche: 'hvac',
  city: 'Saskatoon',
  province: 'SK',
  timezone: 'America/Regina',
  call_handling_mode: 'triage',
})

save('auto-glass-baseline', {
  business_name: 'Windshield Hub',
  agent_name: 'Mark',
  niche: 'auto_glass',
  city: 'Calgary',
  province: 'AB',
  timezone: 'America/Edmonton',
  call_handling_mode: 'triage',
  owner_phone: '+14035550000',
})

save('auto-glass-voicemail-replacement', {
  business_name: 'Windshield Hub',
  agent_name: 'Mark',
  niche: 'auto_glass',
  city: 'Calgary',
  province: 'AB',
  timezone: 'America/Edmonton',
  call_handling_mode: 'triage',
  agent_mode: 'voicemail_replacement',
  owner_phone: '+14035550000',
})

save('real-estate-baseline', {
  business_name: 'Sharif Realty',
  agent_name: 'Aisha',
  niche: 'real_estate',
  city: 'Edmonton',
  province: 'AB',
  timezone: 'America/Edmonton',
  call_handling_mode: 'triage',
  callback_phone: '+17805550000',
})

save('plumbing-appointment-booking', {
  business_name: 'Prairie Plumbing',
  agent_name: 'Jordan',
  niche: 'plumbing',
  city: 'Regina',
  province: 'SK',
  timezone: 'America/Regina',
  call_handling_mode: 'triage',
  agent_mode: 'appointment_booking',
})

console.log('\nDone. Commit the snapshots/ directory before starting the refactor.')
