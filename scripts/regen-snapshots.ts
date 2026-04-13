import { buildPromptFromIntake } from '../src/lib/prompt-builder.js'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SNAPSHOTS = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/__tests__/snapshots')

function write(name: string, content: string) {
  writeFileSync(join(SNAPSHOTS, `${name}.txt`), content.replace(/\r\n/g, '\n'))
  console.log(`✓ ${name}`)
}

write('hvac-baseline', buildPromptFromIntake({
  business_name: 'Prairie HVAC', agent_name: 'Alex', niche: 'hvac',
  city: 'Saskatoon', province: 'SK', timezone: 'America/Regina', call_handling_mode: 'triage',
}))

write('auto-glass-baseline', buildPromptFromIntake({
  business_name: 'Windshield Hub', agent_name: 'Mark', niche: 'auto_glass',
  city: 'Calgary', province: 'AB', timezone: 'America/Edmonton', call_handling_mode: 'triage',
  owner_phone: '+14035550000',
}))

write('auto-glass-voicemail-replacement', buildPromptFromIntake({
  business_name: 'Windshield Hub', agent_name: 'Mark', niche: 'auto_glass',
  city: 'Calgary', province: 'AB', timezone: 'America/Edmonton', call_handling_mode: 'triage',
  agent_mode: 'voicemail_replacement', owner_phone: '+14035550000',
}))

write('plumbing-appointment-booking', buildPromptFromIntake({
  business_name: 'Prairie Plumbing', agent_name: 'Jordan', niche: 'plumbing',
  city: 'Regina', province: 'SK', timezone: 'America/Regina', call_handling_mode: 'triage',
  agent_mode: 'appointment_booking',
}))

console.log('All snapshots updated.')
