/**
 * phase2-extract.ts — ONE-SHOT Phase 2 extraction script.
 *
 * Run: npx tsx src/lib/__tests__/phase2-extract.ts
 *
 * What it does:
 *   1. Reads prompt-builder.ts
 *   2. Creates src/lib/prompt-helpers.ts with 7 pure helper functions
 *   3. Rewrites prompt-builder.ts to import from prompt-helpers
 *
 * Delete this file after Phase 2 is committed.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..') // src/lib/
const BUILDER = join(SRC, 'prompt-builder.ts')

const src = readFileSync(BUILDER, 'utf8')
const lines = src.split('\n')

/** Extract lines [start, end] inclusive (1-based). */
function extractLines(start: number, end: number): string {
  return lines.slice(start - 1, end).join('\n')
}

// ── Identify line ranges for each helper ─────────────────────────────────────
// These must be verified against the current file before running.

// buildNicheFaqDefaults: starts with "function buildNicheFaqDefaults"
const buildNicheFaqStart = lines.findIndex(l => l.startsWith('function buildNicheFaqDefaults')) + 1
// ends at the closing brace (first standalone '}' after the faqMap block)
// The function ends at line where return lines.join('\n') is followed by '}'
let buildNicheFaqEnd = buildNicheFaqStart
for (let i = buildNicheFaqStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    buildNicheFaqEnd = i + 1
    break
  }
}

// buildPrintShopFaq: starts with "function buildPrintShopFaq"
const buildPrintShopStart = lines.findIndex(l => l.startsWith('function buildPrintShopFaq')) + 1
let buildPrintShopEnd = buildPrintShopStart
for (let i = buildPrintShopStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    buildPrintShopEnd = i + 1
    break
  }
}

// buildKnowledgeBase: starts with "function buildKnowledgeBase"
const buildKnowledgeBaseStart = lines.findIndex(l => l.startsWith('function buildKnowledgeBase')) + 1
let buildKnowledgeBaseEnd = buildKnowledgeBaseStart
for (let i = buildKnowledgeBaseStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    buildKnowledgeBaseEnd = i + 1
    break
  }
}

// buildAfterHoursBlock: starts with "function buildAfterHoursBlock"
const buildAfterHoursStart = lines.findIndex(l => l.startsWith('function buildAfterHoursBlock')) + 1
let buildAfterHoursEnd = buildAfterHoursStart
for (let i = buildAfterHoursStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    buildAfterHoursEnd = i + 1
    break
  }
}

// buildCalendarBlock: starts with "function buildCalendarBlock"
const buildCalendarBlockStart = lines.findIndex(l => l.startsWith('function buildCalendarBlock')) + 1
let buildCalendarBlockEnd = buildCalendarBlockStart
for (let i = buildCalendarBlockStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    buildCalendarBlockEnd = i + 1
    break
  }
}

// applyModeVariableOverrides: starts with "function applyModeVariableOverrides"
const applyModeStart = lines.findIndex(l => l.startsWith('function applyModeVariableOverrides')) + 1
let applyModeEnd = applyModeStart
for (let i = applyModeStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    applyModeEnd = i + 1
    break
  }
}

// wrapSectionIfPresent: starts with "function wrapSectionIfPresent"
const wrapSectionStart = lines.findIndex(l => l.startsWith('function wrapSectionIfPresent')) + 1
let wrapSectionEnd = wrapSectionStart
for (let i = wrapSectionStart; i < lines.length; i++) {
  if (lines[i] === '}') {
    wrapSectionEnd = i + 1
    break
  }
}

console.log('Detected line ranges:')
console.log(`  buildNicheFaqDefaults: ${buildNicheFaqStart}-${buildNicheFaqEnd}`)
console.log(`  buildPrintShopFaq: ${buildPrintShopStart}-${buildPrintShopEnd}`)
console.log(`  buildKnowledgeBase: ${buildKnowledgeBaseStart}-${buildKnowledgeBaseEnd}`)
console.log(`  buildAfterHoursBlock: ${buildAfterHoursStart}-${buildAfterHoursEnd}`)
console.log(`  buildCalendarBlock: ${buildCalendarBlockStart}-${buildCalendarBlockEnd}`)
console.log(`  applyModeVariableOverrides: ${applyModeStart}-${applyModeEnd}`)
console.log(`  wrapSectionIfPresent: ${wrapSectionStart}-${wrapSectionEnd}`)

// ── Build prompt-helpers.ts content ──────────────────────────────────────────

const helpersContent = [
  '// Extracted from prompt-builder.ts by phase2-extract.ts — DO NOT EDIT manually.',
  '',
  "import { MODE_VARIABLE_OVERRIDES } from './prompt-config/mode-overrides'",
  "import { wrapSection } from '@/lib/prompt-sections'",
  '',
  'export ' + extractLines(buildNicheFaqStart, buildNicheFaqEnd),
  '',
  '// ── Print shop FAQ (dynamic — uses intake fields) ────────────────────────────',
  '',
  'export ' + extractLines(buildPrintShopStart, buildPrintShopEnd),
  '',
  '// ── Knowledge base builder ────────────────────────────────────────────────────',
  '',
  'export ' + extractLines(buildKnowledgeBaseStart, buildKnowledgeBaseEnd),
  '',
  '// ── After-hours block builder ─────────────────────────────────────────────────',
  '',
  'export ' + extractLines(buildAfterHoursStart, buildAfterHoursEnd),
  '',
  '// ── Calendar booking block (injected when booking_enabled=true) ───────────────',
  '',
  'export ' + extractLines(buildCalendarBlockStart, buildCalendarBlockEnd),
  '',
  '// ── Agent-mode variable overrides ────────────────────────────────────────────',
  '',
  'export ' + extractLines(applyModeStart, applyModeEnd),
  '',
  '// ── Section wrapper helper ────────────────────────────────────────────────────',
  '',
  'export ' + extractLines(wrapSectionStart, wrapSectionEnd),
  '',
].join('\n')

writeFileSync(join(SRC, 'prompt-helpers.ts'), helpersContent, 'utf8')
console.log('\n  created prompt-helpers.ts')

// ── Rewrite prompt-builder.ts ─────────────────────────────────────────────────

console.log('\n  rewriting prompt-builder.ts...')

let out = src

// 1. Add import after the wrapSection import (first line)
// Find the first import line and add our new import after the existing imports block
const importBlockEnd = out.indexOf('\n\n// ── Voice style presets')
if (importBlockEnd === -1) throw new Error('Could not find insertion point for prompt-helpers import')
out = out.slice(0, importBlockEnd) +
  "\nimport { buildNicheFaqDefaults, buildPrintShopFaq, buildKnowledgeBase, buildAfterHoursBlock, buildCalendarBlock, applyModeVariableOverrides, wrapSectionIfPresent } from './prompt-helpers'" +
  out.slice(importBlockEnd)

// 2. Remove each helper function body (replace with a blank line to avoid off-by-one cascades)
// We operate on the UPDATED source so we use string boundary matching, not line numbers

// Helper: remove a function block from source, identified by its "function NAME" signature
function removeFunctionBlock(source: string, fnName: string): string {
  const marker = `function ${fnName}`
  const startIdx = source.indexOf(marker)
  if (startIdx === -1) throw new Error(`Could not find function: ${fnName}`)

  // Walk back to include the preceding comment block (lines starting with //)
  let blockStart = startIdx
  // Find start of the preceding comment section (look back for the '// ──' separator)
  const beforeFn = source.slice(0, startIdx)
  const lastCommentSepIdx = beforeFn.lastIndexOf('\n// ──')
  if (lastCommentSepIdx !== -1 && beforeFn.slice(lastCommentSepIdx).split('\n').every(l => l.match(/^\/\//) || l === '')) {
    blockStart = lastCommentSepIdx + 1 // +1 to skip the \n
  }

  // Find the closing brace of the function
  let depth = 0
  let inFn = false
  let endIdx = startIdx
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === '{') { depth++; inFn = true }
    if (source[i] === '}') {
      depth--
      if (inFn && depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  // Consume trailing newlines
  while (endIdx < source.length && (source[endIdx] === '\n' || source[endIdx] === '\r')) {
    endIdx++
  }

  return source.slice(0, blockStart) + source.slice(endIdx)
}

// Remove the inline MODE_VARIABLE_OVERRIDES import + surrounding comment (it moves to prompt-helpers.ts)
const modeImportComment = '// ── Agent-mode variable overrides (Phase 2b — build-time only) ───────────────'
const modeImportCommentIdx = out.indexOf(modeImportComment)
if (modeImportCommentIdx === -1) throw new Error('Could not find mode-overrides comment block')
const modeImportLineEnd = out.indexOf('\n\n', modeImportCommentIdx)
if (modeImportLineEnd === -1) throw new Error('Could not find end of mode-overrides comment block')
out = out.slice(0, modeImportCommentIdx) + out.slice(modeImportLineEnd + 1)

// Remove all 7 helper function bodies
for (const fnName of [
  'buildNicheFaqDefaults',
  'buildPrintShopFaq',
  'buildKnowledgeBase',
  'buildAfterHoursBlock',
  'buildCalendarBlock',
  'applyModeVariableOverrides',
  'wrapSectionIfPresent',
]) {
  out = removeFunctionBlock(out, fnName)
  console.log(`  removed ${fnName}`)
}

writeFileSync(BUILDER, out, 'utf8')
console.log('  prompt-builder.ts rewritten')
console.log('\nPhase 2 extraction complete. Run tests to verify.')
