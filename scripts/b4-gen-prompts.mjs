import { buildPromptFromIntake } from '../src/lib/prompt-builder.ts'

const intakes = {
  auto_glass: { niche: 'auto_glass', business_name: 'Mountain View Auto Glass', agent_name: 'Sam', city: 'Saskatoon', owner_name: 'Mike', business_hours_weekday: '8:00 AM - 5:30 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
  real_estate: { niche: 'real_estate', business_name: 'Calgary West Realty', agent_name: 'Priya', city: 'Calgary', owner_name: 'Aaron', business_hours_weekday: '9:00 AM - 6:00 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
  property_management: { niche: 'property_management', business_name: 'Riverstone Rentals', agent_name: 'Alisha', city: 'Saskatoon', owner_name: 'Jordan', business_hours_weekday: '9:00 AM - 5:00 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
}

for (const [name, intake] of Object.entries(intakes)) {
  const p = buildPromptFromIntake(intake)
  console.log(`=== ${name} === chars:${p.length}`)
  console.log(p)
  console.log('\n\n---END---\n\n')
}
