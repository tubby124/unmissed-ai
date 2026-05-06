import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NICHE_REGISTRY, getKbStance } from '../niche-registry'
import { buildSlotContext, buildForbiddenActions } from '../prompt-slots'

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
