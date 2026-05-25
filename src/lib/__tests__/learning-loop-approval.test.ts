import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLearningLoopKeyboard,
  canClientApproveSuggestion,
  renderLearningLoopTelegramMessage,
  type LearningLoopSuggestionRow,
} from '../learning-loop/approval'

const baseSuggestion: LearningLoopSuggestionRow = {
  id: '11111111-1111-4111-8111-111111111111',
  client_id: '22222222-2222-4222-8222-222222222222',
  category: 'knowledge_gap',
  risk_level: 'low',
  patch_type: 'extra_qa_append',
  status: 'pending',
  title: 'Add emergency appointment answer',
  summary: 'Caller asked about urgent appointments and the agent gave a vague answer.',
  evidence: { quote: 'Do you guys do emergency appointments?' },
  proposed_patch: {
    question: 'Do you offer emergency appointments?',
    answer: 'Yes — for urgent requests, I can collect your name, number, and issue, then notify the owner right away.',
  },
}

describe('Learning Loop Telegram approval policy', () => {
  test('allows only low-risk client-safe patch types', () => {
    assert.equal(canClientApproveSuggestion(baseSuggestion), true)
    assert.equal(canClientApproveSuggestion({ ...baseSuggestion, risk_level: 'medium' }), false)
    assert.equal(canClientApproveSuggestion({ ...baseSuggestion, patch_type: 'system_prompt_append' }), false)
    assert.equal(canClientApproveSuggestion({ ...baseSuggestion, patch_type: 'business_fact_append' }), true)
  })

  test('renders Telegram approval copy with evidence and suggested update', () => {
    const text = renderLearningLoopTelegramMessage(baseSuggestion)
    assert.match(text, /Suggested agent improvement/)
    assert.match(text, /Call evidence/)
    assert.match(text, /emergency appointments/)
    assert.match(text, /Approve this update/)
  })

  test('builds approve and reject callbacks within Telegram callback limits', () => {
    const keyboard = buildLearningLoopKeyboard(baseSuggestion.id, true)
    const approve = keyboard.inline_keyboard[0][0].callback_data
    const reject = keyboard.inline_keyboard[0][1].callback_data
    assert.equal(approve, `ll:approve:${baseSuggestion.id}`)
    assert.equal(reject, `ll:reject:${baseSuggestion.id}`)
    assert.ok(approve.length <= 64)
    assert.ok(reject.length <= 64)
  })
})
