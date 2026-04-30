/**
 * agent-runtime-state.test.ts — D447 Phase 1
 *
 * Unit tests for the pure helpers powering the Overview runtime-truth feature.
 * No Supabase, no Ultravox, no fetch — these run in isolation.
 *
 * Run: npx tsx --test src/lib/__tests__/agent-runtime-state.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractGreetingFromPrompt,
  classifyDivergence,
  normalizeForCompare,
  withRuntimeStateCache,
  _resetRuntimeStateCache,
} from '../agent-runtime-state.js'

// ── extractGreetingFromPrompt ────────────────────────────────────────────────

describe('extractGreetingFromPrompt', () => {
  describe('strategy 1: unmissed:identity slot marker with quoted line', () => {
    test('returns quoted utterance from inside the identity block', () => {
      const prompt = `<!-- unmissed:identity -->
# IDENTITY

You are Aisha. "Hello, Aisha here from Hasan Realty — how can I help you today?"
<!-- /unmissed:identity -->`
      assert.equal(
        extractGreetingFromPrompt(prompt),
        'Hello, Aisha here from Hasan Realty — how can I help you today?',
      )
    })
  })

  describe('strategy 2: ## 1. GREETING heading inside conversation_flow', () => {
    test('extracts quoted greeting body from numbered heading', () => {
      const prompt = `<!-- unmissed:conversation_flow -->
# DYNAMIC CONVERSATION FLOW

## 1. GREETING

"Windshield Hub — Mark here, AI assistant. What's going on with your vehicle?"

## 2. FILTER
...
<!-- /unmissed:conversation_flow -->`
      assert.equal(
        extractGreetingFromPrompt(prompt),
        "Windshield Hub — Mark here, AI assistant. What's going on with your vehicle?",
      )
    })

    test('handles unnumbered # GREETING heading', () => {
      const prompt = `# GREETING

"Hi, this is Sam at Acme Corp."

# NEXT SECTION
`
      assert.equal(extractGreetingFromPrompt(prompt), 'Hi, this is Sam at Acme Corp.')
    })

    test('handles OPENING as alias for GREETING', () => {
      const prompt = `## OPENING

"Welcome to Urban Vibe, Alisha speaking."`
      assert.equal(
        extractGreetingFromPrompt(prompt),
        'Welcome to Urban Vibe, Alisha speaking.',
      )
    })

    test('falls back to first paragraph when no quote present', () => {
      const prompt = `## GREETING

Be warm and welcoming. Identify yourself by name.

## NEXT
`
      assert.equal(
        extractGreetingFromPrompt(prompt),
        'Be warm and welcoming. Identify yourself by name.',
      )
    })
  })

  describe('strategy 3: first quoted sentence anywhere', () => {
    test('falls back to first quote when no recognizable section structure', () => {
      const prompt = `Some hand-rolled prompt with no headings.

The agent should say "Hi there, this is Pat from Acme." when answering.

Then ask follow-up questions.`
      assert.equal(
        extractGreetingFromPrompt(prompt),
        'Hi there, this is Pat from Acme.',
      )
    })
  })

  describe('returns null', () => {
    test('on empty string', () => {
      assert.equal(extractGreetingFromPrompt(''), null)
    })

    test('on prompts with no quotes and no recognizable headings', () => {
      const prompt = 'just some unstructured text without any greeting marker'
      assert.equal(extractGreetingFromPrompt(prompt), null)
    })

    test('on non-string input', () => {
      // @ts-expect-error testing runtime defense
      assert.equal(extractGreetingFromPrompt(null), null)
      // @ts-expect-error testing runtime defense
      assert.equal(extractGreetingFromPrompt(undefined), null)
    })
  })
})

// ── normalizeForCompare ──────────────────────────────────────────────────────

describe('normalizeForCompare', () => {
  test('strips section markers', () => {
    const input = `<!-- unmissed:identity -->
content
<!-- /unmissed:identity -->`
    assert.equal(normalizeForCompare(input), 'content')
  })

  test('preserves {{templateContext}} placeholders', () => {
    const input = 'before\n\n{{callerContext}}\n\n{{businessFacts}}\n\nafter'
    const out = normalizeForCompare(input)
    assert.ok(out.includes('{{callerContext}}'))
    assert.ok(out.includes('{{businessFacts}}'))
  })

  test('collapses runs of whitespace within lines', () => {
    assert.equal(normalizeForCompare('hello    world'), 'hello world')
  })

  test('collapses 3+ newlines to 2', () => {
    assert.equal(normalizeForCompare('a\n\n\n\n\nb'), 'a\n\nb')
  })

  test('idempotent — second call equals first', () => {
    const input = `  <!-- unmissed:foo -->
x   y\n\n\n\nz
<!-- /unmissed:foo -->  `
    const once = normalizeForCompare(input)
    const twice = normalizeForCompare(once)
    assert.equal(once, twice)
  })

  test('returns empty string on null/undefined/non-string', () => {
    assert.equal(normalizeForCompare(''), '')
    // @ts-expect-error testing runtime defense
    assert.equal(normalizeForCompare(null), '')
    // @ts-expect-error testing runtime defense
    assert.equal(normalizeForCompare(undefined), '')
  })

  test('whitespace-only difference does not register as divergence', () => {
    // db has markers + extra blank lines; runtime has stripped markers.
    // After normalize they should be identical (this is the false-positive
    // guard from D447 risks #3).
    const dbSide = `<!-- unmissed:greeting -->\n# GREETING\n\n"Hi there"\n\n\n<!-- /unmissed:greeting -->`
    const runtimeSide = `# GREETING\n\n"Hi there"`
    assert.equal(normalizeForCompare(dbSide), normalizeForCompare(runtimeSide))
  })
})

// ── classifyDivergence ───────────────────────────────────────────────────────

describe('classifyDivergence', () => {
  test('returns null when db and runtime match (after normalize)', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'Hello world',
      runtime: 'Hello   world',
      syncStatus: 'success',
    })
    assert.equal(result, null)
  })

  test('classifies fake_control when registryEditable=false but values differ', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'A',
      runtime: 'B',
      syncStatus: 'success',
      registryEditable: false,
    })
    assert.ok(result)
    assert.equal(result.reason, 'fake_control')
  })

  test('classifies medium_constraint when mediumConstraint=true', () => {
    const result = classifyDivergence({
      field: 'tools',
      db: 'transferCall',
      runtime: '',
      syncStatus: 'success',
      mediumConstraint: true,
    })
    assert.ok(result)
    assert.equal(result.reason, 'medium_constraint')
  })

  test('classifies plan_gated when planGated=true and includes upgrade CTA', () => {
    const result = classifyDivergence({
      field: 'tools',
      db: 'sendTextMessage',
      runtime: '',
      syncStatus: 'success',
      planGated: true,
    })
    assert.ok(result)
    assert.equal(result.reason, 'plan_gated')
    assert.equal(result.cta?.href, '/dashboard/billing')
  })

  test('classifies propagation_failure when syncStatus=error', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'New greeting',
      runtime: 'Old greeting',
      syncStatus: 'error',
    })
    assert.ok(result)
    assert.equal(result.reason, 'propagation_failure')
    assert.ok(result.cta?.href.includes('/dashboard/settings'))
  })

  test('classifies partial_failure when sync says success but runtime drifts', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'New greeting',
      runtime: 'Stale greeting',
      syncStatus: 'success',
    })
    assert.ok(result)
    assert.equal(result.reason, 'partial_failure')
  })

  test('classifies unknown when syncStatus=unknown and no other hint', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'A',
      runtime: 'B',
      syncStatus: 'unknown',
    })
    assert.ok(result)
    assert.equal(result.reason, 'unknown')
  })

  test('priority: fake_control beats syncStatus signals', () => {
    const result = classifyDivergence({
      field: 'greeting',
      db: 'A',
      runtime: 'B',
      syncStatus: 'error',
      registryEditable: false,
    })
    assert.ok(result)
    // registry-readonly takes precedence — it's the most specific bug class
    assert.equal(result.reason, 'fake_control')
  })

  test('priority: plan_gated beats partial_failure', () => {
    const result = classifyDivergence({
      field: 'tools',
      db: 'X',
      runtime: '',
      syncStatus: 'success',
      planGated: true,
    })
    assert.ok(result)
    assert.equal(result.reason, 'plan_gated')
  })
})

// ── withRuntimeStateCache ────────────────────────────────────────────────────

describe('withRuntimeStateCache', () => {
  test('first call invokes fetcher; second call within TTL returns cached value', async () => {
    _resetRuntimeStateCache()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return { greeting: `Hi ${calls}` }
    }
    const a = await withRuntimeStateCache('client-A', fetcher)
    const b = await withRuntimeStateCache('client-A', fetcher)
    assert.equal(calls, 1, 'fetcher should run once')
    assert.deepEqual(a, b)
  })

  test('different clientIds are cached independently', async () => {
    _resetRuntimeStateCache()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return calls
    }
    const a = await withRuntimeStateCache('client-A', fetcher)
    const b = await withRuntimeStateCache('client-B', fetcher)
    assert.equal(calls, 2)
    assert.notEqual(a, b)
  })

  test('concurrent calls for same clientId share one in-flight fetch', async () => {
    _resetRuntimeStateCache()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      // Simulate Ultravox latency — give the second caller time to attach.
      await new Promise(r => setTimeout(r, 30))
      return calls
    }
    const [a, b, c] = await Promise.all([
      withRuntimeStateCache('client-A', fetcher),
      withRuntimeStateCache('client-A', fetcher),
      withRuntimeStateCache('client-A', fetcher),
    ])
    assert.equal(calls, 1, 'single-flight: only one upstream fetch')
    assert.equal(a, 1)
    assert.equal(b, 1)
    assert.equal(c, 1)
  })

  test('rethrows fetcher errors and clears in-flight (next call retries)', async () => {
    _resetRuntimeStateCache()
    let attempt = 0
    const fetcher = async () => {
      attempt += 1
      if (attempt === 1) throw new Error('upstream down')
      return 'ok'
    }
    await assert.rejects(
      () => withRuntimeStateCache('client-A', fetcher),
      /upstream down/,
    )
    // Second call should retry, not return cached error.
    const out = await withRuntimeStateCache('client-A', fetcher)
    assert.equal(out, 'ok')
    assert.equal(attempt, 2)
  })
})
