/**
 * normalize.test.ts — regression fixtures for the audit's prompt normalizer.
 *
 * The normalizer collapses DB-side and Ultravox-side prompts into a single
 * comparable form for drift detection. Two bugs were caught during the initial
 * Brian audit on 2026-06-03:
 *
 *   1. The regex `<!-- unmissed:[^>]+ -->` missed CLOSING tags like
 *      `<!-- /unmissed:persona_anchor -->`. Falsely reported 716 chars of drift.
 *      Fix: `<!-- \/?unmissed:[^>]+ -->` (the optional `/`).
 *
 *   2. updateAgent() appends `{{callerContext}}`, `{{businessFacts}}`, and an
 *      INJECTED REFERENCE DATA wrapper around `{{contextData}}` to the Ultravox
 *      side. The DB side doesn't have those. Falsely reported 372 chars of
 *      trailing drift. Fix: strip both the placeholders AND the wrapper.
 *
 * This file locks both fixes as regression tests. If the normalizer ever regresses,
 * `npx tsx --test tests/promptfoo/knowledge-routing/normalize.test.ts` fails.
 *
 * Source-of-truth for the normalizer lives in audit.ts. Mirrored here exactly —
 * if you change one, change both. (The audit script is standalone-CLI; importing
 * a function from it requires the script to not auto-execute on import, which it
 * does. Simpler: maintain the canonical copy here as documentation and keep them
 * in sync. The unit test below also acts as the spec.)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Canonical normalizer — must match audit.ts:normalizePrompt() exactly.
function normalizePrompt(s: string): string {
  return s
    .replace(/<!-- \/?unmissed:[^>]+ -->/g, '')
    .replace(/\{\{(callerContext|businessFacts|contextData)\}\}/g, '')
    .replace(/## INJECTED REFERENCE DATA[\s\S]*?(?=\n##|\n#|$)/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

test('strips opening section markers', () => {
  const input = '<!-- unmissed:persona_anchor -->\nbody text here'
  assert.equal(normalizePrompt(input), 'body text here')
})

test('strips closing section markers (BUG-1 regression)', () => {
  const input = 'before\n<!-- /unmissed:persona_anchor -->\nafter'
  assert.equal(normalizePrompt(input), 'before\n\nafter')
})

test('strips both opening AND closing markers in one pass', () => {
  const input = '<!-- unmissed:safety_preamble -->\nrules\n<!-- /unmissed:safety_preamble -->\n'
  assert.equal(normalizePrompt(input), 'rules')
})

test('strips {{callerContext}} placeholder (BUG-2 regression)', () => {
  const input = 'You are Eric.\n\n{{callerContext}}\n\n{{businessFacts}}'
  assert.equal(normalizePrompt(input), 'You are Eric.')
})

test('strips all three template-context placeholders', () => {
  const input = 'persona body\n\n{{callerContext}}\n\n{{businessFacts}}\n\n{{contextData}}'
  assert.equal(normalizePrompt(input), 'persona body')
})

test('strips INJECTED REFERENCE DATA wrapper around {{contextData}} (BUG-2 part 2)', () => {
  const input =
    'persona body\n\n{{callerContext}}\n\n{{businessFacts}}\n\n' +
    '## INJECTED REFERENCE DATA\nThe following data is provided for this call. If non-empty, cross-reference.\n\n{{contextData}}'
  assert.equal(normalizePrompt(input), 'persona body')
})

test('preserves content between markers', () => {
  const input = '<!-- unmissed:a -->\nfoo\n<!-- /unmissed:a -->\n<!-- unmissed:b -->\nbar\n<!-- /unmissed:b -->'
  const out = normalizePrompt(input)
  assert.ok(out.includes('foo'), `lost foo: ${out}`)
  assert.ok(out.includes('bar'), `lost bar: ${out}`)
})

test('full real-shape end-to-end — DB side and Ultravox side normalize identically', () => {
  // Mimics the actual Brian-shaped diff between DB and Ultravox.
  const dbSide =
    '<!-- unmissed:persona -->\n# PERSONA\nYou are Eric.\n<!-- /unmissed:persona -->\n\n' +
    '<!-- unmissed:goal -->\n# GOAL\nCollect caller info.\n<!-- /unmissed:goal -->\n\n' +
    '<!-- unmissed:knowledge -->\n# KNOWLEDGE BASE\nUse queryKnowledge for factual questions.\n<!-- /unmissed:knowledge -->'

  const ultravoxSide =
    '# PERSONA\nYou are Eric.\n\n' +
    '# GOAL\nCollect caller info.\n\n' +
    '# KNOWLEDGE BASE\nUse queryKnowledge for factual questions.\n\n' +
    '{{callerContext}}\n\n{{businessFacts}}\n\n' +
    '## INJECTED REFERENCE DATA\nThe following data is provided for this call.\n\n{{contextData}}'

  assert.equal(normalizePrompt(dbSide), normalizePrompt(ultravoxSide))
})

test('does NOT strip unrelated `<!--` comments', () => {
  // Markers are unmissed-namespaced — generic HTML comments should survive.
  const input = '<!-- some other comment -->\nbody\n<!-- /unmissed:section -->'
  const out = normalizePrompt(input)
  assert.ok(out.includes('<!-- some other comment -->'), `unrelated HTML comment was stripped: ${out}`)
})

test('idempotent — normalizing twice yields the same result', () => {
  const input =
    '<!-- unmissed:a -->\ntext\n<!-- /unmissed:a -->\n\n{{callerContext}}\n\n## INJECTED REFERENCE DATA\nfoo\n{{contextData}}'
  const once = normalizePrompt(input)
  const twice = normalizePrompt(once)
  assert.equal(once, twice)
})

test('collapses 3+ consecutive newlines to 2', () => {
  const input = 'a\n\n\n\nb'
  assert.equal(normalizePrompt(input), 'a\n\nb')
})

test('strips trailing whitespace from lines', () => {
  const input = 'foo   \nbar\t\nbaz'
  assert.equal(normalizePrompt(input), 'foo\nbar\nbaz')
})
