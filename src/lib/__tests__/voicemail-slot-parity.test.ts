/**
 * voicemail-slot-parity.test.ts
 *
 * Structural parity guard: every field in FIELD_REGISTRY that has triggersPatch
 * AND a prompt-affecting mutationClass must be covered by either:
 *   - PATCH_TRIGGER_FIELDS  (hasPatchTrigger=true → voicemail full rebuild fires)
 *   - VOICEMAIL_REBUILD_FIELDS  (hasVoicemailField=true → voicemail full rebuild fires)
 *
 * If this test fails after adding a new patcher or FIELD_REGISTRY entry, you must
 * add the field to PATCH_TRIGGER_FIELDS (surgical patcher path) or VOICEMAIL_REBUILD_FIELDS
 * (voicemail-only fields with no surgical patcher). Never add a field to both.
 *
 * Run: npx tsx --test src/lib/__tests__/voicemail-slot-parity.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { FIELD_REGISTRY } from '../settings-schema.js'
import { PATCH_TRIGGER_FIELDS, VOICEMAIL_REBUILD_FIELDS } from '../settings-patchers.js'

const PROMPT_AFFECTING_CLASSES = new Set([
  'DB_PLUS_PROMPT',
  'DB_PLUS_PROMPT_PLUS_TOOLS',
])

// Fields from FIELD_REGISTRY that have triggersPatch + affect the prompt
const promptPatchFields = Object.entries(FIELD_REGISTRY)
  .filter(([, def]) => def.triggersPatch !== undefined && PROMPT_AFFECTING_CLASSES.has(def.mutationClass))
  .map(([key]) => key)

const patchTriggerSet = new Set(PATCH_TRIGGER_FIELDS)
const vmRebuildSet = new Set(VOICEMAIL_REBUILD_FIELDS)

describe('Voicemail / slot pipeline parity', () => {
  test('every prompt-patching FIELD_REGISTRY field is in PATCH_TRIGGER_FIELDS or VOICEMAIL_REBUILD_FIELDS', () => {
    const uncovered: string[] = []
    for (const field of promptPatchFields) {
      if (!patchTriggerSet.has(field as never) && !vmRebuildSet.has(field as never)) {
        uncovered.push(field)
      }
    }
    assert.deepEqual(
      uncovered,
      [],
      `Fields with triggersPatch not covered by either list (voicemail clients won't rebuild):\n  ${uncovered.join(', ')}\n\nFix: add each field to PATCH_TRIGGER_FIELDS (if a patcher/regen handles it) or VOICEMAIL_REBUILD_FIELDS (voicemail-only).`,
    )
  })

  test('no field appears in both PATCH_TRIGGER_FIELDS and VOICEMAIL_REBUILD_FIELDS (would be redundant)', () => {
    const overlap: string[] = []
    for (const field of VOICEMAIL_REBUILD_FIELDS) {
      if (patchTriggerSet.has(field as never)) {
        overlap.push(field)
      }
    }
    assert.deepEqual(overlap, [], `Fields in both lists (redundant):\n  ${overlap.join(', ')}`)
  })

  test('every field in VOICEMAIL_REBUILD_FIELDS exists in FIELD_REGISTRY', () => {
    const missing: string[] = []
    for (const field of VOICEMAIL_REBUILD_FIELDS) {
      if (!(field in FIELD_REGISTRY)) {
        missing.push(field)
      }
    }
    assert.deepEqual(missing, [], `VOICEMAIL_REBUILD_FIELDS entries not in FIELD_REGISTRY:\n  ${missing.join(', ')}`)
  })

  test('no field in VOICEMAIL_REBUILD_FIELDS has triggersPatch (would already be caught by hasPatchTrigger)', () => {
    // VOICEMAIL_REBUILD_FIELDS is for DB_ONLY fields that the voicemail builder reads directly.
    // Fields with triggersPatch are caught by hasPatchTrigger → voicemail full rebuild fires anyway.
    // Putting a triggersPatch field here would be redundant and signals a category error.
    const wrong: string[] = []
    for (const field of VOICEMAIL_REBUILD_FIELDS) {
      const def = FIELD_REGISTRY[field as keyof typeof FIELD_REGISTRY]
      if (def?.triggersPatch !== undefined) {
        wrong.push(`${field} (triggersPatch: ${def.triggersPatch})`)
      }
    }
    assert.deepEqual(
      wrong,
      [],
      `VOICEMAIL_REBUILD_FIELDS entries that also have triggersPatch (redundant — remove from VOICEMAIL_REBUILD_FIELDS):\n  ${wrong.join(', ')}`,
    )
  })
})
