/**
 * field-registry-coverage.test.ts
 *
 * Structural CI guard: every key written to the `updates` dict by `buildUpdates`
 * in settings-schema.ts must be declared in `FIELD_REGISTRY`.
 *
 * Why this exists: the 2026-06-04 settings-mutation-matrix audit found that
 * `service_areas` was processed by buildUpdates but missing from FIELD_REGISTRY.
 * The omission was harmless (PER_CALL_CONTEXT_ONLY needs no sync), but it made
 * the registry incomplete as an audit surface. This test ensures the matrix
 * and the code stay in sync — any new field added to buildUpdates without a
 * corresponding registry declaration fails the build.
 *
 * Approach:
 *   1. Read settings-schema.ts source text
 *   2. Extract every literal `updates.<key>` and `updates[<key>]` assignment
 *   3. Diff against FIELD_REGISTRY keys
 *   4. Fail if any assignment target is not declared
 *
 * Source-text-driven (not runtime-driven) so it works without constructing a
 * synthetic body that exercises every optional field.
 *
 * Run: npx tsx --test src/lib/__tests__/field-registry-coverage.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIELD_REGISTRY } from '../settings-schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '..', 'settings-schema.ts')

// Side-effect keys written by buildUpdates that are NOT user-facing fields.
// These are intentional derived writes that don't need a FIELD_REGISTRY entry.
const ALLOWLISTED_SIDE_EFFECTS = new Set([
  'updated_at',                 // Set whenever system_prompt is touched
  'injected_note_expires_at',   // Auto-set 24h expiry when injected_note saves
])

describe('FIELD_REGISTRY coverage', () => {
  const source = readFileSync(SCHEMA_PATH, 'utf-8')

  // Extract all `updates.X =` and `updates['X'] =` assignment targets from
  // the buildUpdates function body. Conservative — only matches assignments,
  // not reads. Captures simple identifier keys.
  const assignmentRegex = /\bupdates\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g
  const bracketRegex = /\bupdates\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]\s*=/g
  const writtenKeys = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = assignmentRegex.exec(source)) !== null) {
    writtenKeys.add(match[1])
  }
  while ((match = bracketRegex.exec(source)) !== null) {
    writtenKeys.add(match[1])
  }

  test('extracted at least 30 fields from buildUpdates (sanity check on regex)', () => {
    assert.ok(
      writtenKeys.size >= 30,
      `Expected ≥30 fields extracted from buildUpdates, got ${writtenKeys.size}. ` +
      `Possible regex breakage — extracted: [${Array.from(writtenKeys).join(', ')}]`,
    )
  })

  test('every key written by buildUpdates is declared in FIELD_REGISTRY', () => {
    const declared = new Set(Object.keys(FIELD_REGISTRY))
    const undeclared: string[] = []

    for (const key of writtenKeys) {
      if (declared.has(key)) continue
      if (ALLOWLISTED_SIDE_EFFECTS.has(key)) continue
      undeclared.push(key)
    }

    assert.deepEqual(
      undeclared.sort(),
      [],
      `\n\nbuildUpdates writes these keys but they are NOT in FIELD_REGISTRY:\n` +
      `  ${undeclared.join(', ')}\n\n` +
      `Fix: add an entry to FIELD_REGISTRY in src/lib/settings-schema.ts.\n` +
      `If the field is a side-effect (like updated_at), add it to ALLOWLISTED_SIDE_EFFECTS in this test.\n\n` +
      `See vault note 2026-06-04-settings-mutation-matrix.md for the audit that motivated this guard.`,
    )
  })

  // NOTE: A reverse-direction "every registry entry is written somewhere" check
  // was considered but rejected. buildUpdates writes many fields via bulk loops
  // over arrays of literal keys (e.g. trimNullable, trimRequired, boolFields,
  // directFields) using `updates[key] = ...` where `key` is a loop variable.
  // The assignment regex above only catches `updates.X` literal access patterns.
  // A reverse check produces 40+ false positives. If we want it back, we have
  // to ALSO parse the bulk-loop arrays — not worth the complexity for a guard
  // that catches no real bugs (dead registry entries are easy to spot in review).
})
