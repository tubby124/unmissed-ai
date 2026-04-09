import { buildSlotContext, buildPersonaAnchor, buildSafetyPreamble, buildForbiddenActions, buildVoiceNaturalness, buildGrammar, buildIdentity, buildToneAndStyle, buildGoal, buildConversationFlow, buildAfterHoursSlot, buildEscalationTransfer, buildReturningCaller, buildInlineExamples, buildCallHandlingMode, buildFaqPairsSlot, buildObjectionHandling, buildKnowledgeBaseSlot, buildCalendarBookingSlot, buildSmsFollowupSlot, buildVipProtocolSlot, buildRecencyAnchor } from '../src/lib/prompt-slots.ts'

const intake = { niche: 'auto_glass', business_name: 'Mountain View Auto Glass', agent_name: 'Sam', city: 'Saskatoon', owner_name: 'Mike', business_hours_weekday: '8:00 AM - 5:30 PM', voice_style_preset: 'casual_friendly', call_handling_mode: 'triage' }
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

let total = 0
for (const [name, content] of slots) {
  total += content.length
  console.log(`${String(content.length).padStart(6)} chars  ${name}`)
}
console.log(`${String(total).padStart(6)} chars  TOTAL`)
