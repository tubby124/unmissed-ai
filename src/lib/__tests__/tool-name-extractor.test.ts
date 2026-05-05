import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractToolName,
  normalizeToolNames,
  type UnknownToolShape,
} from '../tool-name-extractor.js'

describe('extractToolName', () => {
  test('recognizes built-in tools by top-level toolName', () => {
    assert.equal(
      extractToolName({ toolName: 'hangUp', parameterOverrides: { strict: true } }),
      'hangUp',
    )
  })

  test('recognizes built-in tool references by top-level nameOverride', () => {
    assert.equal(
      extractToolName({
        toolId: '56294126-5a7d-4948-b67d-3b7e13d55ea7',
        nameOverride: 'hangUp',
        parameterOverrides: { strict: true },
      }),
      'hangUp',
    )
  })

  test('recognizes inline custom tools by temporaryTool.modelToolName', () => {
    assert.equal(
      extractToolName({
        temporaryTool: {
          modelToolName: 'sendTextMessage',
          http: { httpMethod: 'POST', baseUrlPattern: 'https://example.test/sms' },
        },
      }),
      'sendTextMessage',
    )
  })
})

describe('normalizeToolNames', () => {
  test('keeps known tool wire shapes sorted by name', () => {
    const names = normalizeToolNames([
      { temporaryTool: { modelToolName: 'sendTextMessage' } },
      { nameOverride: 'hangUp', toolId: 'built-in-hangup-id' },
      { toolName: 'queryCorpus' },
    ])

    assert.deepEqual(names, ['hangUp', 'queryCorpus', 'sendTextMessage'])
  })

  test('logs and preserves unknown tool shapes instead of silently dropping them', () => {
    const unknowns: UnknownToolShape[] = []
    const names = normalizeToolNames(
      [
        { toolName: 'hangUp' },
        { toolId: 'unrecognized-without-name' },
      ],
      {
        source: 'unit-test',
        onUnknown: unknown => unknowns.push(unknown),
      },
    )

    assert.deepEqual(names, ['__UNKNOWN_TOOL_SHAPE_1__', 'hangUp'])
    assert.equal(unknowns.length, 1)
    assert.equal(unknowns[0]?.index, 1)
    assert.equal(unknowns[0]?.source, 'unit-test')
    assert.deepEqual(unknowns[0]?.tool, { toolId: 'unrecognized-without-name' })
  })
})
