import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('capability card explains the voicemail replacement core truthfully', () => {
  const source = readFileSync('src/components/dashboard/CapabilitiesCard.tsx', 'utf8')

  assert.match(source, /urgency, service type, and preferred callback time/i)
  assert.match(source, /Email summaries are the default/i)
  assert.match(source, /Booking, SMS, and live transfer stay gated/i)
})

test('agent knowledge card explains sources and refusal boundary', () => {
  const source = readFileSync('src/components/dashboard/home/AgentKnowsCard.tsx', 'utf8')

  assert.match(source, /Google Business Profile, website facts, FAQs, services, and hours/i)
  assert.match(source, /will not guess/i)
  assert.match(source, /answered by a person/i)
})
