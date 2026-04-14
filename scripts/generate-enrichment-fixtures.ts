// scripts/generate-enrichment-fixtures.ts
// Run: npx tsx scripts/generate-enrichment-fixtures.ts
// Writes 6 static prompt .txt files for promptfoo enrichment tests.
import { buildPromptFromIntake } from '../src/lib/prompt-builder'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '../tests/promptfoo/prompts')
mkdirSync(OUT, { recursive: true })

const BASE_BUSINESS = {
  business_name: 'Summit HVAC Services',
  niche: 'hvac',
  owner_name: 'Mike',
  city: 'Calgary',
  state: 'AB',
  agent_name: 'Jordan',
  call_handling_mode: 'triage',
  after_hours_behavior: 'take_message',
  triage_rules: [
    { keyword: 'emergency', action: 'route_emergency', phone: '403-555-0199' },
  ],
}

// L0 — bare intake, no external data
const l0 = buildPromptFromIntake({ ...BASE_BUSINESS })

// L1 — + GBP summary
const l1 = buildPromptFromIntake({
  ...BASE_BUSINESS,
  gbp_summary: 'Summit HVAC Services is open Monday to Friday 8am-6pm, Saturday 9am-2pm. Located at 210 Centre St NW, Calgary AB. Known for fast response times and Lennox system expertise. 4.8 stars across 312 reviews.',
})

// L2 — + website scrape facts (represented as caller_faq since business_facts/extra_qa are KB-layer, not stored prompt)
const l2 = buildPromptFromIntake({
  ...BASE_BUSINESS,
  gbp_summary: 'Summit HVAC Services is open Monday to Friday 8am-6pm, Saturday 9am-2pm. Located at 210 Centre St NW, Calgary AB. 4.8 stars across 312 reviews.',
  caller_faq: [
    'Q: What services do you offer?\nA: We offer furnace repair, AC installation, heat pump maintenance, and duct cleaning.',
    'Q: Do you offer financing?\nA: Yes — financing is available through FinanceIt at 0% for 12 months.',
    'Q: Can I get a same-day appointment?\nA: Yes, same-day emergency appointments are available — just call us.',
  ].join('\n\n'),
})

// L3 — + manual FAQs + sonar enrichment
const l3 = buildPromptFromIntake({
  ...BASE_BUSINESS,
  gbp_summary: 'Summit HVAC Services is open Monday to Friday 8am-6pm, Saturday 9am-2pm. Located at 210 Centre St NW, Calgary AB. 4.8 stars across 312 reviews.',
  caller_faq: [
    'Q: What services do you offer?\nA: We offer furnace repair, AC installation, heat pump maintenance, and duct cleaning.',
    'Q: How much does a furnace tune-up cost?\nA: A standard tune-up is $129 including a 21-point inspection. Book online or ask us to schedule.',
    'Q: Do you work on Carrier units?\nA: Yes — we service all major brands including Carrier, Lennox, Trane, and York.',
  ].join('\n\n'),
  sonar_content: 'Summit HVAC Services (summithvac.ca) has been operating in Calgary since 2009. Owner Mike Reeves is a Red Seal certified gas fitter. The company specialises in residential and light commercial HVAC. They are an authorised Lennox dealer and offer a 2-year parts and labour warranty on all installations.',
})

// other niche — no recognised niche, AI-generated config simulated
const otherNiche = buildPromptFromIntake({
  business_name: 'Prairie Dog Grooming',
  niche: 'other',
  agent_name: 'Sam',
  city: 'Saskatoon',
  state: 'SK',
  call_handling_mode: 'triage',
  after_hours_behavior: 'take_message',
  custom_niche_config: {
    industry: 'pet grooming',
    primary_call_reason: 'book a grooming appointment',
    triage_deep: 'HOT = caller needs same-day or next-day grooming for a specific reason (event, mat removal, skin issue). WARM = interested, wants to book a future slot. COLD = asking about prices or services only. JUNK = spam, robocall, wrong number.',
    info_to_collect: 'pet name, breed, grooming service needed, preferred time',
    faq_defaults: [
      'How long does a grooming session take? — Usually 2 to 3 hours depending on the breed and coat condition.',
      'Do you do walk-ins? — We prefer appointments but will take walk-ins when space allows.',
      'What breeds do you work with? — All breeds welcome, from small dogs to large breeds.',
      'Do you offer nail trimming only? — Yes, nail trims are available as a standalone service.',
      'Are your products safe for sensitive skin? — Yes, we use hypoallergenic shampoos on request.',
    ],
    classification_rule: 'HOT = same-day need or urgent grooming issue, WARM = wants to book, COLD = info only, JUNK = spam or wrong number.',
    close_person: 'our groomer',
    close_action: 'call you back to book your visit',
  },
})

// restaurant niche — Treasure House Mexican Bakery style
const restaurant = buildPromptFromIntake({
  business_name: 'Treasure House Mexican Bakery',
  niche: 'restaurant',
  agent_name: 'Sofia',
  city: 'Saskatoon',
  state: 'SK',
  call_handling_mode: 'triage',
  after_hours_behavior: 'take_message',
  hours_weekday: '9am to 6pm',
})

const fixtures: Record<string, string> = {
  'enrichment-l0.txt': l0,
  'enrichment-l1.txt': l1,
  'enrichment-l2.txt': l2,
  'enrichment-l3.txt': l3,
  'other-niche.txt': otherNiche,
  'restaurant-fixture.txt': restaurant,
}

for (const [name, content] of Object.entries(fixtures)) {
  const path = join(OUT, name)
  writeFileSync(path, content, 'utf8')
  console.log(`✓ ${name} (${content.length} chars)`)
}
console.log('Done.')
