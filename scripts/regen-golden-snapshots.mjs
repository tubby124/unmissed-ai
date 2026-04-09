// Regenerate all 5 Layer 1 golden snapshots used by prompt-builder-golden.test.ts.
// Run whenever a slot change is INTENTIONAL and the diff has been manually reviewed.
// Usage: npx tsx scripts/regen-golden-snapshots.mjs

import { writeFileSync } from 'fs'
import { join } from 'path'
import { buildPromptFromIntake } from '../src/lib/prompt-builder.ts'

const SNAPSHOTS = join(process.cwd(), 'src/lib/__tests__/snapshots')

const fixtures = [
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

for (const { name, intake } of fixtures) {
  const prompt = buildPromptFromIntake(intake)
  writeFileSync(join(SNAPSHOTS, `${name}.txt`), prompt)
  console.log(`wrote ${name}.txt — ${prompt.length} chars`)
}
