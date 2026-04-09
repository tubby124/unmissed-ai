import fs from 'fs'
import { buildPromptFromIntake } from '../src/lib/prompt-builder.ts'
import { buildSlotContext, buildPersonaAnchor, buildSafetyPreamble, buildForbiddenActions, buildVoiceNaturalness, buildGrammar, buildIdentity, buildToneAndStyle, buildGoal, buildConversationFlow, buildAfterHoursSlot, buildEscalationTransfer, buildReturningCaller, buildInlineExamples, buildCallHandlingMode, buildFaqPairsSlot, buildObjectionHandling, buildKnowledgeBaseSlot, buildCalendarBookingSlot, buildSmsFollowupSlot, buildVipProtocolSlot, buildRecencyAnchor } from '../src/lib/prompt-slots.ts'

const intakes = {
  auto_glass: { niche: 'auto_glass', business_name: 'Mountain View Auto Glass', agent_name: 'Sam', city: 'Saskatoon', owner_name: 'Mike', business_hours_weekday: '8:00 AM - 5:30 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
  real_estate: { niche: 'real_estate', business_name: 'Calgary West Realty', agent_name: 'Priya', city: 'Calgary', owner_name: 'Aaron', business_hours_weekday: '9:00 AM - 6:00 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
  property_management: { niche: 'property_management', business_name: 'Riverstone Rentals', agent_name: 'Alisha', city: 'Saskatoon', owner_name: 'Jordan', business_hours_weekday: '9:00 AM - 5:00 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' },
}

const out = []
for (const [name, intake] of Object.entries(intakes)) {
  const fullPrompt = buildPromptFromIntake(intake)
  const ctx = buildSlotContext(intake)
  const slots = [
    ['0  PERSONA_ANCHOR', buildPersonaAnchor(ctx)],
    ['1  SAFETY_PREAMBLE', buildSafetyPreamble()],
    ['2  FORBIDDEN_ACTIONS', buildForbiddenActions(ctx)],
    ['3  VOICE_NATURALNESS', buildVoiceNaturalness(ctx)],
    ['4  GRAMMAR', buildGrammar()],
    ['5  IDENTITY', buildIdentity(ctx)],
    ['6  TONE_AND_STYLE', buildToneAndStyle(ctx)],
    ['7  GOAL', buildGoal(ctx)],
    ['8  CONVERSATION_FLOW', buildConversationFlow(ctx)],
    ['9  AFTER_HOURS', buildAfterHoursSlot(ctx)],
    ['10 ESCALATION_TRANSFER', buildEscalationTransfer(ctx)],
    ['11 RETURNING_CALLER', buildReturningCaller()],
    ['12 INLINE_EXAMPLES', buildInlineExamples(ctx)],
    ['13 CALL_HANDLING_MODE', buildCallHandlingMode(ctx)],
    ['14 FAQ_PAIRS', buildFaqPairsSlot(ctx)],
    ['15 OBJECTION_HANDLING', buildObjectionHandling(ctx)],
    ['16 KNOWLEDGE_BASE', buildKnowledgeBaseSlot(ctx)],
    ['17 CALENDAR_BOOKING', buildCalendarBookingSlot(ctx)],
    ['18 SMS_FOLLOWUP', buildSmsFollowupSlot(ctx)],
    ['19 VIP_PROTOCOL', buildVipProtocolSlot(ctx)],
    ['20 RECENCY_ANCHOR', buildRecencyAnchor(ctx)],
  ]
  out.push({ niche: name, total: fullPrompt.length, slots: slots.map(([n, c]) => ({ name: n, chars: c.length })), prompt: fullPrompt })
}
fs.writeFileSync('/tmp/b4-analysis.json', JSON.stringify(out, null, 2))
console.log('Saved /tmp/b4-analysis.json')
