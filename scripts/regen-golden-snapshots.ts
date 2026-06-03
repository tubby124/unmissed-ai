// Regenerates the 5 Layer 1 golden snapshots in src/lib/__tests__/snapshots/.
// Run after intentional changes to slot wording (e.g. Bug 3 in buildReturningCaller).
//
// Usage:
//   npx tsx scripts/regen-golden-snapshots.ts
//
// Fixtures mirror prompt-builder-golden.test.ts Layer 1 exactly. If those change,
// keep this script in sync.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPromptFromIntake } from '../src/lib/prompt-builder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOTS = join(__dirname, '..', 'src', 'lib', '__tests__', 'snapshots')

const FIXTURES: Array<{ name: string; intake: Record<string, unknown> }> = [
  {
    name: 'hvac-baseline',
    intake: {
      business_name: 'Prairie HVAC',
      agent_name: 'Alex',
      niche: 'hvac',
      city: 'Saskatoon',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
    },
  },
  {
    name: 'auto-glass-baseline',
    intake: {
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      niche: 'auto_glass',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      owner_phone: '+14035550000',
    },
  },
  {
    name: 'auto-glass-voicemail-replacement',
    intake: {
      business_name: 'Windshield Hub',
      agent_name: 'Mark',
      niche: 'auto_glass',
      city: 'Calgary',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      agent_mode: 'voicemail_replacement',
      owner_phone: '+14035550000',
    },
  },
  {
    name: 'real-estate-baseline',
    intake: {
      business_name: 'Sharif Realty',
      agent_name: 'Aisha',
      niche: 'real_estate',
      city: 'Edmonton',
      province: 'AB',
      timezone: 'America/Edmonton',
      call_handling_mode: 'triage',
      callback_phone: '+17805550000',
    },
  },
  {
    name: 'plumbing-appointment-booking',
    intake: {
      business_name: 'Prairie Plumbing',
      agent_name: 'Jordan',
      niche: 'plumbing',
      city: 'Regina',
      province: 'SK',
      timezone: 'America/Regina',
      call_handling_mode: 'triage',
      agent_mode: 'appointment_booking',
    },
  },
]

for (const { name, intake } of FIXTURES) {
  const out = buildPromptFromIntake(intake)
  const path = join(SNAPSHOTS, `${name}.txt`)
  writeFileSync(path, out)
  console.log(`wrote ${name}.txt (${out.length} chars)`)
}
