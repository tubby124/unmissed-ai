/**
 * Generate the Sal's NY Pizza system prompt using the real prompt pipeline.
 * Simulates the full onboarding → provision → prompt generation flow.
 *
 * Usage: npx tsx tests/promptfoo/scripts/generate-pizza-prompt.ts
 */

import { buildPromptFromIntake, validatePrompt } from '../../../src/lib/prompt-builder'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load domain knowledge as business_facts context
const knowledgePath = join(__dirname, '../../../clients/sals-ny-pizza/domain-knowledge.md')
const domainKnowledge = readFileSync(knowledgePath, 'utf-8')

// Extract menu + policies as business facts (what gets injected at call time via businessFacts)
const menuSection = domainKnowledge.split('## Menu')[1]?.split('## Policies')[0]?.trim() || ''
const policiesSection = domainKnowledge.split('## Policies')[1]?.split('## What Sal needs')[0]?.trim() || ''

// Simulate the intelligence seed that Haiku would generate
const INTELLIGENCE_SEED = {
  TRIAGE_DEEP: `FOOD_ORDER:
Ask: "are you looking to place an order for pickup or delivery?"
Triggers: order, pizza, pickup, delivery, takeout, hungry, 12 inch, 20 inch, pie, pasta, calzone
→ Collect: items + sizes, pickup or delivery, name, pickup time or delivery address
→ Outcome: take order details for Sal

CATERING:
Ask: "nice — how many people and when is the event?"
Triggers: catering, party, event, large order, group, feeding, corporate, wedding, birthday
→ Collect: date, guest count, menu preference, contact name, phone number
→ Outcome: give quote callback from Sal

RESERVATION:
Ask: "how many people and what time works best for you?"
Triggers: reservation, table, dine-in, book, party of, seating
→ Collect: party size, date, time, name, phone number
→ Outcome: confirm dine-in reservation

MENU_OR_INFO:
Ask: "would you like to hear about our menu, hours, or location?"
Triggers: menu, hours, address, location, what do you have, prices, garlic knots, salad
→ Collect: specific item or info requested
→ Outcome: answer from knowledge base — use exact prices from menu

URGENT:
Triggers: complaint, wrong order, missing items, food quality issue, never arrived, food poisoning
→ Skip triage, flag [URGENT], take brief description + name → Sal calls back ASAP

SPAM_OR_WRONG_NUMBER:
Triggers: unrelated business, telemarketer, survey, political, wrong number
→ "thanks, not interested — have a good day." then use hangUp tool`,

  GREETING_LINE: `"Sal's NY Pizza — Marco here! I can help you order pizza, check our menu, book a table, or arrange catering. What can I do for you?"`,

  URGENCY_KEYWORDS: `"wrong order", "missing items", "food poisoning", "cold pizza", "late delivery", "never arrived", "complaint", "refund needed", "quality issue", "allergic reaction"`,

  FORBIDDEN_EXTRA: `NEVER promise delivery under 30 minutes or guarantee specific arrival times — say "usually 30-45 minutes, could be up to 60 on busy nights"
NEVER offer discounts, refunds, or compensation — always say "Sal will call ya back to sort that out"
NEVER take payment information over the phone — cash or card in person only
NEVER confirm allergen safety — always say "our kitchen is not nut-free and we can't guarantee cross-contamination — best to check with us in person for severe allergies"`,
}

// Build the intake object simulating what the provision route receives
const intake: Record<string, unknown> = {
  niche: 'restaurant',
  business_name: "Sal's NY Pizza",
  agent_name: 'Marco',
  city: 'Calgary',
  call_handling_mode: 'triage',
  agent_mode: 'lead_capture',
  hours_weekday: 'Mon-Thu 11am-10pm, Fri-Sat 11am-11pm',
  hours_weekend: 'Sun 12pm-9pm',
  callback_phone: '(403) 555-7272',
  services_offered: 'pizza, pasta, calzones, salads, garlic knots, catering',
  voice_style_preset: 'casual_friendly',
  // CLOSE_PERSON must be set so the prompt says "Sal" not "the boss"
  close_person: 'Sal',
  niche_custom_variables: {
    ...INTELLIGENCE_SEED,
    CLOSE_PERSON: 'Sal',
  },
  // Restaurant-specific niche fields
  niche_cuisineType: 'New York style pizza restaurant',
  niche_orderTypes: 'dine-in, takeout, delivery',
  niche_cancelPolicy: '24h',
  niche_partySize: '20',
}

// Build the prompt
const prompt = buildPromptFromIntake(intake)
const validation = validatePrompt(prompt)

// Output to stdout for piping
process.stdout.write(prompt)

// Validation info to stderr
process.stderr.write(`\n--- Prompt Stats ---\n`)
process.stderr.write(`Chars: ${validation.charCount}\n`)
process.stderr.write(`Valid: ${validation.valid}\n`)
if (validation.warnings.length > 0) {
  process.stderr.write(`Warnings: ${validation.warnings.join(', ')}\n`)
}
