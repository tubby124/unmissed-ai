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
  assert.equal(getKbStance('home_renovation'), 'permissive')
})

test('home_renovation niche has kb-aware FORBIDDEN_EXTRA from day one', () => {
  const fe = NICHE_DEFAULTS.home_renovation?.FORBIDDEN_EXTRA ?? ''
  assert.ok(fe.length > 0, 'home_renovation must define FORBIDDEN_EXTRA')
  assert.match(fe, /queryKnowledge first/i,
    'home_renovation FORBIDDEN_EXTRA must include queryKnowledge first priming')
  assert.match(fe, /site visit/i,
    'home_renovation must route specific quotes to a site visit')
  assert.match(fe, /flag \[URGENT\]/i,
    'home_renovation must flag urgent damage (water leak, structural, fire)')
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

test('real_estate FORBIDDEN_EXTRA preserves FHA + valuation absolutes', () => {
  const fe = NICHE_DEFAULTS.real_estate.FORBIDDEN_EXTRA
  assert.match(fe, /Fair Housing Act|Human Rights/i)
  assert.match(fe, /demographic|coded language/i)
  assert.match(fe, /home valuation|price-per-square-foot|comp values?/i)
  assert.match(fe, /agent's personal phone/i)
})

test('real_estate FORBIDDEN_EXTRA commission rule is KB-conditional', () => {
  const fe = NICHE_DEFAULTS.real_estate.FORBIDDEN_EXTRA
  // Old blanket form gone
  assert.ok(!/NEVER discuss commission rates.*on the call/i.test(fe),
    'old blanket-block commission rule must be removed')
  // New form distinguishes general published rates from client-specific terms
  assert.match(fe, /queryKnowledge|general.*commission|published.*commission|listing commission/i,
    'commission rule must allow general published structures via KB')
  assert.match(fe, /client-specific|this listing|negotiated splits/i,
    'commission rule must explicitly route client-specific terms')
})

test('real_estate FORBIDDEN_EXTRA preserves mortgage + cold-caller absolutes', () => {
  const fe = NICHE_DEFAULTS.real_estate.FORBIDDEN_EXTRA
  // Mortgage rates / financing — absolute
  assert.match(fe, /mortgage rates|financing approval/i)
  // Cold-caller deflection — absolute
  assert.match(fe, /cold-calling|recruiting agents|pitching/i)
})

test('real_estate FORBIDDEN_EXTRA commission rule has anti-chunk guard', () => {
  const fe = NICHE_DEFAULTS.real_estate.FORBIDDEN_EXTRA
  assert.match(fe, /queryKnowledge results referencing.*listings.*negotiated splits.*must be ignored/i,
    'commission rule must instruct ignoring KB chunks about specific listings/splits')
})

test('dental FORBIDDEN_EXTRA preserves clinical-advice absolute', () => {
  const fe = NICHE_DEFAULTS.dental.FORBIDDEN_EXTRA
  // Clinical advice is ABSOLUTE — patient safety
  assert.match(fe, /NEVER give clinical advice|diagnose conditions|recommend treatments/i)
  // Must resist KB chunks even if they contain clinical examples
  assert.match(fe, /even if a chunk.*clinical examples|regardless of what queryKnowledge/i)
})

test('dental FORBIDDEN_EXTRA procedure pricing is KB-conditional', () => {
  const fe = NICHE_DEFAULTS.dental.FORBIDDEN_EXTRA
  // Old blanket form gone
  assert.ok(!/NEVER quote specific procedure prices — always route/i.test(fe),
    'old blanket-block procedure-pricing rule must be removed')
  // New form allows general published ranges via KB
  assert.match(fe, /queryKnowledge|published.*price|general.*price|financing/i,
    'procedure pricing must allow general published ranges via KB')
  // Specific patient quotes still route
  assert.match(fe, /specific.*patient|this patient|out-of-pocket/i,
    'pricing rule must route patient-specific cost quotes')
})

test('dental FORBIDDEN_EXTRA procedure pricing has anti-chunk guard', () => {
  const fe = NICHE_DEFAULTS.dental.FORBIDDEN_EXTRA
  assert.match(fe, /queryKnowledge results referencing.*patient.*treatment|treatment plans.*must be ignored/i,
    'pricing rule must instruct ignoring KB chunks about specific patient treatment plans')
})

test('dental FORBIDDEN_EXTRA scheduling is KB-conditional', () => {
  const fe = NICHE_DEFAULTS.dental.FORBIDDEN_EXTRA
  // Old blanket form gone
  assert.ok(!/NEVER confirm or deny appointment availability — always route/i.test(fe),
    'old blanket-block availability rule must be removed')
  // General hours/process can come from KB
  assert.match(fe, /queryKnowledge|general.*office hours|appointment types|new-patient/i,
    'scheduling rule must allow general hours/process via KB')
  // Specific slot availability still routes
  assert.match(fe, /specific.*slot|check the schedule/i,
    'scheduling rule must route specific slot availability queries')
})

// ─── Future-niche regression guards ─────────────────────────────────────────
// These tests enforce the kb-aware pattern across the entire NICHE_REGISTRY
// so any future niche added must follow the same shape.

const ABSOLUTE_CARVE_OUT_KEYWORDS = [
  // Expert/clinical/legal carve-outs that SHOULD remain blanket-route:
  /legal advice|interpret law|legal strategy/i,
  /clinical advice|medical advice|diagnose/i,
  /recommend specific (hair|product|treatment|style)/i,
  /guarantee.*outcome/i,
  /pest elimination outcomes/i,
  /unit-specific|tenant-specific|file-specific|case-specific/i,
  /transfer the call|put.*on hold|personal phone number/i,
  /confirm dates.*key arrangements|deposit amounts|inspection outcomes/i,
  /specific renewal terms|rent increases|notice periods/i,
  /specific financial figures|vacancy rates|maintenance history/i,
  /commission|fee|listing fee|negotiated split/i,
  /property prices|home valuation|market estimate|price-per-square-foot/i,
  /promise a showing time|listing availability/i,
  /quote prices for items NOT listed/i,
  // Agent persona / pronunciation / dispatch rules — not KB-related:
  /apologize for being AI|act uncertain about your role/i,
  /spell it out|never\s+["']/i,
  /promise a specific arrival time|locksmith will call.*ETA/i,
  /guarantee a specific barber/i,
]

function isAbsoluteCarveOut(line: string): boolean {
  return ABSOLUTE_CARVE_OUT_KEYWORDS.some(rx => rx.test(line))
}

test('regression: every niche with blanket-route rules also has KB-first priming OR absolute carve-outs', () => {
  const violations: string[] = []
  for (const [niche, defaults] of Object.entries(NICHE_DEFAULTS)) {
    const fe = (defaults as { FORBIDDEN_EXTRA?: string }).FORBIDDEN_EXTRA ?? ''
    if (!fe) continue
    const lines = fe.split('\n')
    const blanketLines = lines.filter(l => /NEVER[^\n]*(always route|— route\b)/i.test(l))
    if (blanketLines.length === 0) continue
    const hasKbFirst = /queryKnowledge first/i.test(fe)
    // For each blanket line, it must EITHER be an absolute carve-out OR be paired with a KB-first rule
    for (const line of blanketLines) {
      if (isAbsoluteCarveOut(line)) continue
      if (!hasKbFirst) {
        violations.push(`${niche}: blanket-route without kb-first companion: "${line.trim().slice(0,120)}"`)
      }
    }
  }
  assert.equal(violations.length, 0,
    `Future-niche kb-aware regression — these niches need kb-first priming added:\n  - ${violations.join('\n  - ')}`)
})

test('regression: every niche FORBIDDEN_EXTRA references queryKnowledge OR has only absolute carve-outs', () => {
  // Soft check: warn on niches with NEVER rules but no queryKnowledge mention at all.
  // Skip niches with empty/no FORBIDDEN_EXTRA.
  const warnings: string[] = []
  for (const [niche, defaults] of Object.entries(NICHE_DEFAULTS)) {
    const fe = (defaults as { FORBIDDEN_EXTRA?: string }).FORBIDDEN_EXTRA ?? ''
    if (!fe) continue
    const hasNever = /NEVER /i.test(fe)
    const hasQK = /queryKnowledge/i.test(fe)
    if (hasNever && !hasQK) {
      const allLines = fe.split('\n').filter(l => /NEVER /i.test(l))
      const allAbsolute = allLines.every(isAbsoluteCarveOut)
      if (!allAbsolute) {
        warnings.push(niche)
      }
    }
  }
  assert.equal(warnings.length, 0,
    `Niches with NEVER rules but no queryKnowledge reference (review whether they need kb-aware update): ${warnings.join(', ')}`)
})
