import { writeFileSync } from 'fs'
import { join } from 'path'
import { buildPromptFromIntake } from '../src/lib/prompt-builder.ts'

const SNAPSHOTS = join(process.cwd(), 'src/lib/__tests__/snapshots')

// auto-glass-baseline
const baseline = buildPromptFromIntake({
  business_name: 'Windshield Hub',
  agent_name: 'Mark',
  niche: 'auto_glass',
  city: 'Calgary',
  province: 'AB',
  timezone: 'America/Edmonton',
  call_handling_mode: 'triage',
  owner_phone: '+14035550000',
})
writeFileSync(join(SNAPSHOTS, 'auto-glass-baseline.txt'), baseline)
console.log('wrote auto-glass-baseline.txt', baseline.length, 'chars')

// auto-glass-voicemail-replacement
const vmr = buildPromptFromIntake({
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
writeFileSync(join(SNAPSHOTS, 'auto-glass-voicemail-replacement.txt'), vmr)
console.log('wrote auto-glass-voicemail-replacement.txt', vmr.length, 'chars')
