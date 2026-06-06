/**
 * Regenerate Layer 1 golden snapshots after a sandwich-spec slot edit.
 * Run after any change to prompt-slots.ts that affects baseline output.
 *
 *   npx tsx scripts/regenerate-prompt-snapshots.ts
 *
 * Mirrors the fixtures used in
 *   src/lib/__tests__/prompt-builder-golden.test.ts (Layer 1).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPromptFromIntake } from '../src/lib/prompt-builder'

const SNAPSHOTS = join(process.cwd(), 'src/lib/__tests__/snapshots')

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n')
}

const fixtures: Array<{ name: string; intake: Record<string, unknown> }> = [
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

for (const f of fixtures) {
  const out = norm(buildPromptFromIntake(f.intake))
  const path = join(SNAPSHOTS, `${f.name}.txt`)
  writeFileSync(path, out, 'utf8')
  console.log(`wrote ${f.name}.txt (${out.length} chars)`)
}
