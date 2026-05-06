import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NICHE_REGISTRY, getKbStance } from '../niche-registry'
import { buildSlotContext, buildForbiddenActions } from '../prompt-slots'
import { NICHE_DEFAULTS } from '../prompt-config/niche-defaults'

test('strict niches get kbStance=strict', () => {
  assert.equal(getKbStance('property_management'), 'strict')
  assert.equal(getKbStance('legal'), 'strict')
  assert.equal(getKbStance('real_estate'), 'strict')
  assert.equal(getKbStance('dental'), 'strict')
})

test('permissive niches get kbStance=permissive', () => {
  assert.equal(getKbStance('auto_glass'), 'permissive')
  assert.equal(getKbStance('hvac'), 'permissive')
  assert.equal(getKbStance('restaurant'), 'permissive')
  assert.equal(getKbStance('salon'), 'permissive')
  assert.equal(getKbStance('barbershop'), 'permissive')
})

test('unknown niches default to permissive', () => {
  assert.equal(getKbStance('made_up_niche'), 'permissive')
})

test('every NICHE_REGISTRY entry has a kbStance', () => {
  for (const key of Object.keys(NICHE_REGISTRY)) {
    const stance = getKbStance(key)
    assert.ok(stance === 'strict' || stance === 'permissive',
      `${key} missing or invalid kbStance: ${stance}`)
  }
})

test('hyphenated DB slugs route through norm() to underscored keys', () => {
  assert.equal(getKbStance('property-management'), 'strict')
  assert.equal(getKbStance('real-estate'), 'strict')
  assert.equal(getKbStance('auto-glass'), 'permissive')
})

test('null/undefined niche values default to permissive', () => {
  assert.equal(getKbStance(null), 'permissive')
  assert.equal(getKbStance(undefined), 'permissive')
})

test('buildSlotContext sets kbStance=strict for property_management', () => {
  const ctx = buildSlotContext({
    niche: 'property_management',
    business_name: 'Test Properties',
    agent_name: 'Test',
    timezone: 'America/Edmonton',
    knowledge_backend: 'pgvector',
  } as never)
  assert.equal(ctx.kbStance, 'strict')
})

test('buildSlotContext sets kbStance=permissive for auto_glass', () => {
  const ctx = buildSlotContext({
    niche: 'auto_glass',
    business_name: 'Test Glass',
    agent_name: 'Test',
    timezone: 'America/Edmonton',
  } as never)
  assert.equal(ctx.kbStance, 'permissive')
})

test('buildSlotContext handles hyphenated niche slugs', () => {
  const ctx = buildSlotContext({
    niche: 'real-estate',
    business_name: 'Test Realty',
    agent_name: 'Test',
    timezone: 'America/Edmonton',
  } as never)
  assert.equal(ctx.kbStance, 'strict')
})

const baseForbiddenCtx = {
  agentName: 'Brian',
  businessName: 'Calgary Property Leasing',
  closePerson: 'Brian',
  completionFields: 'name and reason',
  pricingPolicy: 'no_quotes' as const,
  transferEnabled: false,
  forbiddenExtraRules: [],
  industry: 'property management company',
  knowledgeBackend: '',
  knowledgeChunkCount: 0,
  kbStance: 'permissive' as const,
}

test('FORBIDDEN_ACTIONS has no KB priming when KB empty', () => {
  const out = buildForbiddenActions(baseForbiddenCtx as never)
  assert.ok(!out.includes('queryKnowledge'),
    'KB priming must NOT emit when knowledgeChunkCount=0')
})

test('FORBIDDEN_ACTIONS has no KB priming when backend != pgvector', () => {
  const out = buildForbiddenActions({
    ...baseForbiddenCtx,
    knowledgeBackend: 'inline',
    knowledgeChunkCount: 6,
  } as never)
  assert.ok(!out.includes('queryKnowledge'),
    'KB priming must NOT emit when backend is not pgvector')
})

test('FORBIDDEN_ACTIONS emits KB-first priming when populated (permissive)', () => {
  const out = buildForbiddenActions({
    ...baseForbiddenCtx,
    knowledgeBackend: 'pgvector',
    knowledgeChunkCount: 6,
  } as never)
  assert.ok(out.includes('queryKnowledge'),
    'KB priming must emit when chunks > 0')
  assert.ok(/queryKnowledge first/i.test(out),
    'permissive stance: should include "queryKnowledge first" phrasing')
})

test('FORBIDDEN_ACTIONS emits KB-conditional priming when populated (strict)', () => {
  const out = buildForbiddenActions({
    ...baseForbiddenCtx,
    kbStance: 'strict',
    knowledgeBackend: 'pgvector',
    knowledgeChunkCount: 6,
  } as never)
  assert.ok(out.includes('queryKnowledge'),
    'KB priming must emit when chunks > 0')
  assert.ok(/general polic|policy question/i.test(out),
    'strict stance: must mention "general policies" or similar to distinguish from specifics')
})

test('FORBIDDEN_ACTIONS KB priming includes booking/emergency exclusion', () => {
  const out = buildForbiddenActions({
    ...baseForbiddenCtx,
    knowledgeBackend: 'pgvector',
    knowledgeChunkCount: 6,
  } as never)
  assert.match(out, /Do NOT call queryKnowledge for greetings, emergencies, or booking/i,
    'KB priming must exclude greetings/emergencies/booking from queryKnowledge calls')
})

test('property_management FORBIDDEN_EXTRA preserves FHA + ESA carve-outs', () => {
  const fe = NICHE_DEFAULTS.property_management.FORBIDDEN_EXTRA
  assert.match(fe, /Fair Housing Act/i)
  assert.match(fe, /service animal|ESA/)
  assert.match(fe, /demographic/i)
})

test('property_management FORBIDDEN_EXTRA preserves P1 / pest carve-outs', () => {
  const fe = NICHE_DEFAULTS.property_management.FORBIDDEN_EXTRA
  assert.match(fe, /9-1-1|emergency|burst pipe|gas/i)
  assert.match(fe, /bedbug|pest/i)
})

test('property_management FORBIDDEN_EXTRA SCOPE rule is KB-conditional, not blanket', () => {
  const fe = NICHE_DEFAULTS.property_management.FORBIDDEN_EXTRA
  // Old blanket form must be gone
  assert.ok(!/NEVER confirm or deny rent amounts.*always route/i.test(fe),
    'old blanket-block SCOPE rule must be removed')
  // New form must distinguish general policy from unit specifics
  assert.match(fe, /queryKnowledge|general (building )?polic/i)
  assert.match(fe, /unit-specific|specific unit|this unit/i)
})

test('property_management FORBIDDEN_EXTRA preserves legal-advice prohibition', () => {
  const fe = NICHE_DEFAULTS.property_management.FORBIDDEN_EXTRA
  assert.match(fe, /NEVER give legal advice/i)
  assert.match(fe, /RTA|eviction|landlord-rights/i)
})

test('property_management TRIAGE_DEEP RENTAL INQUIRY is KB-conditional', () => {
  const td = NICHE_DEFAULTS.property_management.TRIAGE_DEEP
  // Old blanket form gone
  assert.ok(!/NEVER answer questions about availability, pricing, pets, parking, or utilities/i.test(td),
    'old RENTAL INQUIRY blanket-block must be removed')
  // New form must mention queryKnowledge OR distinguish general from specific
  assert.match(td, /queryKnowledge|GENERAL questions/i)
  assert.match(td, /SPECIFIC unit|this listing|this unit/i)
})

test('property_management TRIAGE_DEEP preserves $-amount prohibition', () => {
  const td = NICHE_DEFAULTS.property_management.TRIAGE_DEEP
  // Should still prohibit quoting dollar amounts even from KB chunks
  assert.match(td, /(never|don't) quote a dollar amount|exact numbers/i)
})

test('property_management FORBIDDEN_EXTRA SCOPE rule covers unit-availability case', () => {
  const fe = NICHE_DEFAULTS.property_management.FORBIDDEN_EXTRA
  // Prospect asking "is unit X still available" must route, not query KB
  assert.match(fe, /whether this unit is still available/i,
    'FORBIDDEN_EXTRA SCOPE rule must list unit availability as unit-specific (route, not KB)')
})

test('legal FORBIDDEN_EXTRA preserves absolute prohibitions', () => {
  const fe = NICHE_DEFAULTS.legal.FORBIDDEN_EXTRA
  // Legal advice prohibition is ABSOLUTE — must remain blanket
  assert.match(fe, /NEVER give legal advice|interpret law|legal strategy/i)
  // Confidentiality is ABSOLUTE — must remain blanket
  assert.match(fe, /confidential|other clients/i)
})

test('legal FORBIDDEN_EXTRA fee rule is KB-conditional', () => {
  const fe = NICHE_DEFAULTS.legal.FORBIDDEN_EXTRA
  // Old blanket form gone
  assert.ok(!/NEVER discuss fees, retainers, or billing rates — always route/i.test(fe),
    'old blanket-block fee rule must be removed')
  // New form references KB lookup or general-vs-specific
  assert.match(fe, /queryKnowledge|published.*fee|general fee structure|standard.*rate/i,
    'fee rule must allow general published fee info via KB')
})

test('legal FORBIDDEN_EXTRA tightens KB usage on case-outcomes + confidentiality', () => {
  const fe = NICHE_DEFAULTS.legal.FORBIDDEN_EXTRA
  // Case outcomes must explicitly resist KB chunks that hint at them
  assert.match(fe, /case outcomes.*even if a chunk|chunk.*examples/i,
    'case-outcomes rule must explicitly defend against KB chunks suggesting outcomes')
  // Confidentiality must instruct ignoring KB chunks referencing specific cases
  assert.match(fe, /queryKnowledge.*specific.*cases|specific.*cases.*ignored/i,
    'confidentiality rule must instruct ignoring KB chunks about specific cases')
})
