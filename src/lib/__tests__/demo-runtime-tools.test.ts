import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoRuntimeTools, formatDemoToolList } from '../demo-runtime-tools'

function toolNames(tools: object[]): string[] {
  return tools
    .map(tool => {
      const entry = tool as {
        toolName?: unknown
        temporaryTool?: {
          modelToolName?: unknown
        }
      }
      return entry.temporaryTool?.modelToolName ?? entry.toolName
    })
    .filter((name): name is string => typeof name === 'string')
}

describe('buildDemoRuntimeTools', () => {
  it('adds queryKnowledge only when approved knowledge is available', () => {
    const tools = buildDemoRuntimeTools('unmissed-demo', {
      hasPhoneMedium: false,
      hasCallerPhone: true,
      calendarEnabled: true,
      transferEnabled: false,
      knowledgeEnabled: true,
    })
    assert.deepEqual(toolNames(tools), ['transitionToBookingStage', 'sendTextMessage', 'queryKnowledge'])
  })

  it('does not add queryKnowledge when knowledge is not approved', () => {
    const tools = buildDemoRuntimeTools('unmissed-demo', {
      hasPhoneMedium: true,
      hasCallerPhone: true,
      calendarEnabled: true,
      transferEnabled: true,
      knowledgeEnabled: false,
    })
    assert.deepEqual(toolNames(tools), ['transitionToBookingStage', 'sendTextMessage', 'transferCall'])
  })

  it('formats tool labels for prompt context', () => {
    const labels = formatDemoToolList(buildDemoRuntimeTools('unmissed-demo', {
      hasPhoneMedium: true,
      hasCallerPhone: true,
      calendarEnabled: true,
      transferEnabled: true,
      knowledgeEnabled: true,
    }))
    assert.equal(labels, 'transitionToBookingStage, sendTextMessage, transferCall, queryKnowledge')
  })
})
