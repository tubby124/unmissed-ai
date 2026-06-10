/**
 * system-prompt-writer-allowlist.test.ts
 *
 * Architectural rule guard (Hasan's 2026-06-04 reformation mandate):
 *
 *   "Every future provision must go through the slot pipeline as if onboarded
 *    through the website."
 *
 * Concretely: only an audited, allowlisted set of files may write
 * `clients.system_prompt` to the database. A new file added by a future PR
 * that calls `.update({ system_prompt: ... })` on the `clients` table will
 * fail this test until either:
 *   (a) added to ALLOWED_WRITERS with a documented rationale, OR
 *   (b) refactored to route through one of the canonical write paths.
 *
 * Why this matters: 2026-06-04 Track 4 audit found that 8/10 system_prompt
 * writers already comply with the slot-pipeline rule. The remaining 2 are
 * intentional escape hatches (admin-save-prompt) or deferred-sync migrations
 * (backfill-sms-prompt). Without a CI guard, drift slips back in silently.
 *
 * Approach:
 *   1. Recursively grep src/ for `.update({...}).eq(...)` patterns that include
 *      `system_prompt:` as an updated field.
 *   2. Map each match to its source file.
 *   3. Diff against ALLOWED_WRITERS.
 *   4. Fail if any unknown file writes system_prompt.
 *
 * Run: npx tsx --test src/lib/__tests__/system-prompt-writer-allowlist.test.ts
 *
 * Reference: vault note 2026-06-04-session-complete-tracks-1-4.md §Track 4
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')

// The 10 files audited 2026-06-04 as legitimate system_prompt writers.
// Each entry must include a one-line rationale documenting why this file
// is allowed to write the field. If you're adding a new writer, ADD A
// RATIONALE — don't just allowlist it.
const ALLOWED_WRITERS: Record<string, string> = {
  // ── Canonical settings PATCH path ──────────────────────────────────────
  'src/app/api/dashboard/settings/route.ts':
    'Canonical settings PATCH. Routes through applyPromptPatches + regenerateSlots.',

  // ── Provisioning (slot-pipeline via buildPromptFromIntake) ─────────────
  'src/app/api/provision/trial/route.ts':
    'Trial provisioning. Builds initial prompt via buildPromptFromIntake.',
  'src/app/api/dashboard/generate-prompt/route.ts':
    'Onboarding initial generation. buildPromptFromIntake → updateAgent.',
  'src/app/api/dashboard/regenerate-prompt/route.ts':
    '"Regenerate from intake" endpoint. buildPromptFromIntake + separate Ultravox sync.',
  'src/app/api/admin/test-activate/route.ts':
    'Admin test-mode activation. buildPromptFromIntake + createAgent/updateAgent.',

  // ── Slot-pipeline canonical helpers ────────────────────────────────────
  'src/lib/slot-regenerator.ts':
    'IS the slot pipeline. Used by settings route + variables route + auto-regen.',
  'src/lib/auto-regen.ts':
    'Async low-stakes regen. Wraps buildPromptFromIntake + updateAgent.',

  // ── Targeted patcher writes (slot-pipeline-compatible) ────────────────
  'src/app/api/dashboard/variables/route.ts':
    'Variable PATCH. Uses regenerateSlots + syncToUltravox.',
  'src/app/api/auth/google/callback/route.ts':
    'OAuth completion. patchCalendarBlock (slot-compatible) + full updateAgent + tools sync.',

  // ── Admin-only escape hatches (flagged in Track 4 audit) ──────────────
  'src/app/api/admin/save-prompt/route.ts':
    'Admin raw-paste escape hatch. Bypasses patcher chain BUT does full Ultravox sync. ' +
    'TODO(2026-06-04): wrap with audit trail (change_description + admin_audit row + Telegram alert).',
  'src/app/api/admin/backfill-sms-prompt/route.ts':
    'Admin bulk migration. Uses patchSmsBlock (slot-compatible) but skips Ultravox sync. ' +
    'TODO(2026-06-04): add triggerUltravoxSync: true post-step to close deferred-sync gap.',

  // ── Append-style writers (slot-pipeline-unification candidates) ───────
  'src/app/api/dashboard/analysis/[id]/route.ts':
    'Auto-applied analytics recommendation. Appends `// Auto-applied recommendation` block ' +
    'to system_prompt + full Ultravox sync. TODO(2026-06-04): refactor to write via extra_qa ' +
    '(via reseedKnowledgeFromSettings) so the recommendation flows through the KB pipeline ' +
    'instead of bolting text onto the stored prompt.',
  'src/app/api/dashboard/settings/prompt-versions/route.ts':
    'Prompt version rollback. Restores a previously-vetted prompt_versions.content snapshot ' +
    'to clients.system_prompt + full Ultravox sync. Legitimate "undo" path — content was ' +
    'already audited at the original write time.',
  'src/lib/learning-loop/approval.ts':
    'Learning Loop system_prompt_append. When owner approves a suggestion, appends approved ' +
    'text under "## LEARNING LOOP APPROVED UPDATES" block + full Ultravox sync + insertPromptVersion. ' +
    'TODO(2026-06-04): route through extra_qa/business_facts when patch_type is faq-like, ' +
    'so smart-promoted answers reseed the KB instead of bolting text onto the prompt.',
}

/**
 * Find every src/ file that writes clients.system_prompt via a Supabase update.
 *
 * Match pattern: source line containing `system_prompt:` immediately AFTER a
 * line containing `.update({`. We use a two-line grep so we don't match
 * select clauses or type definitions.
 *
 * Falls back to a simpler grep + post-filter when ripgrep isn't available.
 */
function findSystemPromptWriters(): Set<string> {
  // Conservative approach: grep for all files that contain `system_prompt:`
  // as an assignment target (followed by a value), then filter by context.
  //
  // We can't easily do multi-line regex with `grep`, so we use a Node-based
  // approach: read every TS file under src/app/api and src/lib, scan for the
  // pattern .update({...system_prompt:...}) or .update({ system_prompt: ... })
  // including multi-line.

  const findCmd = `find "${REPO_ROOT}/src/app/api" "${REPO_ROOT}/src/lib" -type f -name "*.ts" -not -path "*/__tests__/*" -not -path "*/node_modules/*" -not -name "database.types.ts"`
  const allFiles = execSync(findCmd, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)

  const writers = new Set<string>()

  for (const absPath of allFiles) {
    const text = readFileSync(absPath, 'utf-8')

    // Match `.update({ ... system_prompt: ... })` — possibly multi-line.
    // The update call body must contain a literal `system_prompt:` key.
    //
    // Find every `.update(` and check the matching closing `)` window for
    // a system_prompt key. Simple scanner.
    let idx = 0
    while ((idx = text.indexOf('.update(', idx)) !== -1) {
      // Find matching `)` allowing for nested braces/parens. Brittle but
      // works for typical Supabase update bodies which are flat objects.
      let depth = 0
      let cursor = idx + '.update('.length
      let foundClose = -1
      while (cursor < text.length) {
        const ch = text[cursor]
        if (ch === '(' || ch === '{' || ch === '[') depth += 1
        else if (ch === ')' || ch === '}' || ch === ']') {
          if (depth === 0 && ch === ')') { foundClose = cursor; break }
          depth -= 1
        }
        cursor += 1
      }

      if (foundClose === -1) break // unbalanced; give up

      const body = text.slice(idx, foundClose + 1)
      // Match `system_prompt:` as a key in the update body. Exclude
      // `system_prompt_chars` (audit log metadata, not a real column).
      if (/\bsystem_prompt\s*:/.test(body) && !/system_prompt_chars\s*:/.test(body)) {
        writers.add(relative(REPO_ROOT, absPath))
      }

      idx = foundClose + 1
    }
  }

  return writers
}

describe('system_prompt writer allowlist', () => {
  const writers = findSystemPromptWriters()

  test('found at least 8 system_prompt writers (sanity check on scanner)', () => {
    assert.ok(
      writers.size >= 8,
      `Expected ≥8 writers (Track 4 audit found 10), got ${writers.size}.\n` +
      `Found: ${Array.from(writers).join(', ')}\n` +
      `Possible scanner breakage.`,
    )
  })

  test('every writer is in the allowlist', () => {
    const undocumented: string[] = []

    for (const writer of writers) {
      if (writer in ALLOWED_WRITERS) continue
      undocumented.push(writer)
    }

    assert.deepEqual(
      undocumented.sort(),
      [],
      `\n\nThese files write clients.system_prompt but are NOT in ALLOWED_WRITERS:\n` +
      undocumented.map(p => `  ${p}`).join('\n') +
      `\n\nIf the write is legitimate (slot-pipeline-compatible or admin escape hatch),\n` +
      `add an entry with a one-line rationale to ALLOWED_WRITERS in this test file.\n\n` +
      `If the write bypasses the slot pipeline silently, refactor it to route\n` +
      `through one of:\n` +
      `  - PATCH /api/dashboard/settings  (canonical for user-facing changes)\n` +
      `  - regenerateSlots()              (canonical for slot-level rebuilds)\n` +
      `  - buildPromptFromIntake()        (canonical for full rebuilds)\n\n` +
      `Reference: vault note 2026-06-04-session-complete-tracks-1-4.md §Track 4.`,
    )
  })

  // NOTE: A reverse-direction "no dead allowlist entries" check was considered
  // but rejected because the scanner has a known blind spot:
  // it only detects inline `.update({ system_prompt: ... })` bodies. Files that
  // build the update dict as a variable first (e.g. `const dbUpdates = { system_prompt: ... }`
  // then `.update(dbUpdates)`) are not caught. The canonical settings PATCH
  // (src/app/api/dashboard/settings/route.ts) and regenerate-prompt route both
  // use this pattern. Adding AST analysis to handle them is overkill for a
  // guard — manual review catches stale entries during PR cleanup.
})
