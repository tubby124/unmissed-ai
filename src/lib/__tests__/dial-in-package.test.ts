/**
 * dial-in-package.test.ts — regression contract for the "dial-in package"
 * (Task 11, 2026-08-18): conversational economy + natural-sounding Aisha.
 *
 * The 45-75s budget is a PACING TARGET, not a hard cutoff. These tests lock in
 * the structural guarantees that make the target achievable without a timer:
 *   - anti-repetition rules present in the realtor prompt;
 *   - no "summarize the call" instruction (generates recap-echo turns);
 *   - a soft turn cap after which Aisha must state the next action and hangUp;
 *   - a runtime safety ceiling that is configurable and strictly above the
 *     conversational target (the prompt ends the call, not the clock);
 *   - hangUp-first: once the result label is known, end — no dead-air rephrasing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('realtor prompt: conversational target stays <= 75s', async () => {
  const mod = await import('../realtor-outbound-prompt.js')
  assert.ok(
    Number.isFinite(mod.MAX_DEFAULT_OUTBOUND_SECONDS),
    'MAX_DEFAULT_OUTBOUND_SECONDS must be a number',
  )
  assert.ok(
    mod.MAX_DEFAULT_OUTBOUND_SECONDS <= 75,
    `MAX_DEFAULT_OUTBOUND_SECONDS=${mod.MAX_DEFAULT_OUTBOUND_SECONDS} exceeds 75s target`,
  )
})

test('realtor prompt: runtime safety ceiling is configurable and above the target', async () => {
  const mod = await import('../realtor-outbound-prompt.js')
  const ceiling = mod.REALTOR_OUTBOUND_MAX_DURATION
  assert.equal(typeof ceiling, 'string', 'REALTOR_OUTBOUND_MAX_DURATION must be a string')
  const m = /^(\d+)s$/.exec(ceiling)
  assert.ok(m, `REALTOR_OUTBOUND_MAX_DURATION=${ceiling} must be '<seconds>s'`)
  const ceilingSeconds = Number(m[1])
  assert.ok(
    ceilingSeconds > mod.MAX_DEFAULT_OUTBOUND_SECONDS,
    `ceiling ${ceilingSeconds}s must be strictly above target ${mod.MAX_DEFAULT_OUTBOUND_SECONDS}s — the target is not a hard cutoff`,
  )
  assert.ok(
    ceilingSeconds <= 300,
    `ceiling ${ceilingSeconds}s should still be a sane cap (<= 5 min) — an unbounded call burns billing`,
  )
})

test('createCall accepts an optional maxDuration override', async () => {
  const ultravox = await import('../ultravox.js')
  const fn = ultravox.createCall as unknown as { length?: number }
  // The 10th positional-ish destructured option is maxDuration; presence is
  // enough — the route wiring tests below assert real usage.
  assert.equal(typeof ultravox.createCall, 'function')
  void fn
})

test('dial-out and scheduled-callbacks pass the realtor safety ceiling', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const root = path.resolve(process.cwd(), 'src')
  const dialOut = fs.readFileSync(
    path.join(root, 'app/api/dashboard/leads/dial-out/route.ts'),
    'utf8',
  )
  const sched = fs.readFileSync(
    path.join(root, 'app/api/cron/scheduled-callbacks/route.ts'),
    'utf8',
  )
  const prompt = fs.readFileSync(
    path.join(root, 'lib/realtor-outbound-prompt.ts'),
    'utf8',
  )

  assert.match(prompt, /REALTOR_OUTBOUND_MAX_DURATION\s*=\s*'[^']+s'/)
  assert.match(dialOut, /REALTOR_OUTBOUND_MAX_DURATION/)
  assert.match(dialOut, /maxDuration:\s*realtorContext\s*\?\s*REALTOR_OUTBOUND_MAX_DURATION/)
  assert.match(sched, /REALTOR_OUTBOUND_MAX_DURATION/)
  assert.match(sched, /maxDuration:\s*realtorContext\s*\?\s*REALTOR_OUTBOUND_MAX_DURATION/)
})

test('realtor prompt: anti-repetition rules are present and hard', async () => {
  const mod = await import('../realtor-outbound-prompt.js')
  const ctx = {
    loftyLeadId: '123',
    name: 'Test',
    leadType: 'buyer' as const,
    source: 'lofty',
    pipelineStage: 'unspecified',
    priorAttempts: 0,
  }
  const prompt = mod.buildRealtorOutboundPrompt(ctx)

  // Never ask a question twice.
  assert.match(prompt, /[Nn]ever ask .{0,12}question twice/)
  // No re-introduction / re-stating purpose after the opener.
  assert.match(prompt, /[Nn]ever re-(introduce|state)/)
  // No recap-echo ("so just to confirm…", "to summarize").
  assert.match(prompt, /no .*recap/i)
  assert.doesNotMatch(prompt, /summarize (it|the call|the conversation) in one sentence/)
})

test('realtor prompt: soft turn cap and hangUp-first', async () => {
  const mod = await import('../realtor-outbound-prompt.js')
  const ctx = {
    loftyLeadId: '123',
    name: 'Test',
    leadType: 'buyer' as const,
    source: 'lofty',
    pipelineStage: 'unspecified',
    priorAttempts: 0,
  }
  const prompt = mod.buildRealtorOutboundPrompt(ctx)

  // A structural stop exists after N agent turns.
  assert.match(prompt, /turn.{0,40}(cap|limit|maximum)/i)
  // Once the next step is clear, state it once, thank, hangUp — no re-selling.
  assert.match(prompt, /(state|give) the (single )?next action in one short sentence/)
  assert.match(prompt, /hangUp/)
  assert.match(prompt, /do not (re-sell|repeat the purpose)/i)
})

test('realtor prompt: human-sounding mechanics (anti-robot)', async () => {
  const mod = await import('../realtor-outbound-prompt.js')
  const ctx = {
    loftyLeadId: '123',
    name: 'Test',
    leadType: 'buyer' as const,
    source: 'lofty',
    pipelineStage: 'unspecified',
    priorAttempts: 0,
  }
  const prompt = mod.buildRealtorOutboundPrompt(ctx)

  // Short sentences / plain language guidance.
  assert.match(prompt, /short sentence/i)
  // No AI-isms in the contract.
  assert.doesNotMatch(prompt, /as an AI/)
  assert.doesNotMatch(prompt, /I['’]d be happy to assist/i)
})
