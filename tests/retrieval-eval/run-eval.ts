#!/usr/bin/env npx tsx
/**
 * run-eval.ts — Retrieval evaluation runner
 *
 * Usage:
 *   npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub
 *   npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub --verbose
 *   npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub --production
 *   npx tsx tests/retrieval-eval/run-eval.ts --compare results/a.json results/b.json
 *
 * Env vars:
 *   EVAL_BASE_URL          — API base (default: http://localhost:3000)
 *   WEBHOOK_SIGNING_SECRET — X-Tool-Secret header value
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  type EvalQuestion,
  type EvalResult,
  type QueryResponse,
  type EvalReport,
  type Thresholds,
  CANARY_THRESHOLDS,
  PRODUCTION_THRESHOLDS,
} from './lib/types'
import { scoreQuestion, aggregateScores } from './lib/scorer'
import { printScorecard, writeReport, compareReports } from './lib/reporter'

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

const hasFlag = (flag: string) => args.includes(flag)

// Handle --compare mode
if (hasFlag('--compare')) {
  const files = args.filter(a => !a.startsWith('--'))
  if (files.length !== 2) {
    console.error('Usage: --compare <older.json> <newer.json>')
    process.exit(1)
  }
  const older: EvalReport = JSON.parse(fs.readFileSync(files[0], 'utf-8'))
  const newer: EvalReport = JSON.parse(fs.readFileSync(files[1], 'utf-8'))
  compareReports(older, newer)
  process.exit(0)
}

const slug = getArg('--slug')
if (!slug) {
  console.error('Usage: npx tsx run-eval.ts --slug <client-slug> [--verbose] [--production]')
  process.exit(1)
}

const verbose = hasFlag('--verbose')
const useProductionThresholds = hasFlag('--production')
const thresholds: Thresholds = useProductionThresholds ? PRODUCTION_THRESHOLDS : CANARY_THRESHOLDS

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000'
const TOOL_SECRET = process.env.WEBHOOK_SIGNING_SECRET || ''

// ── Load eval set ───────────────────────────────────────────────────────────────

const evalSetPath = path.join(__dirname, 'eval-sets', `${slug}.json`)
if (!fs.existsSync(evalSetPath)) {
  console.error(`Eval set not found: ${evalSetPath}`)
  console.error(`Create one from the template: tests/retrieval-eval/eval-sets/_template.json`)
  process.exit(1)
}

const questions: EvalQuestion[] = JSON.parse(fs.readFileSync(evalSetPath, 'utf-8'))
console.log(`Loaded ${questions.length} questions from ${evalSetPath}`)
console.log(`Target: ${BASE_URL}/api/knowledge/${slug}/query`)
console.log(`Thresholds: ${useProductionThresholds ? 'PRODUCTION' : 'CANARY'}`)
console.log('')

// ── Run eval ────────────────────────────────────────────────────────────────────

async function queryKnowledge(question: string): Promise<{ response: QueryResponse | null; latency_ms: number }> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/knowledge/${slug}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(TOOL_SECRET ? { 'X-Tool-Secret': TOOL_SECRET } : {}),
      },
      body: JSON.stringify({ query: question }),
    })
    const latency_ms = Date.now() - start

    if (!res.ok) {
      console.error(`  HTTP ${res.status} for "${question.slice(0, 60)}..."`)
      return { response: null, latency_ms }
    }

    const data: QueryResponse = await res.json()
    return { response: data, latency_ms }
  } catch (err) {
    const latency_ms = Date.now() - start
    console.error(`  Fetch error for "${question.slice(0, 60)}...": ${err}`)
    return { response: null, latency_ms }
  }
}

async function runEval(): Promise<void> {
  const evalStart = Date.now()
  const results: EvalResult[] = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    process.stdout.write(`  [${i + 1}/${questions.length}] ${q.id}: "${q.question.slice(0, 50)}..."`)

    const { response, latency_ms } = await queryKnowledge(q.question)
    const verdicts = scoreQuestion(q, response)

    results.push({
      id: q.id,
      question: q.question,
      expected: q,
      response,
      latency_ms,
      verdicts,
    })

    // Inline status
    const status = []
    if (verdicts.retrieval_hit === false) status.push('MISS')
    if (verdicts.wrong_source === true) status.push('WRONG')
    if (verdicts.empty_when_should_have === true) status.push('EMPTY')
    if (verdicts.unnecessary_call === true) status.push('UNNECESSARY')
    if (verdicts.correct_silence === false) status.push('FALSE_POS')

    const resultCount = response?.count ?? 0
    const topSim = response?.results?.[0]?.similarity?.toFixed(3) ?? 'n/a'
    const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : ''
    console.log(` -> ${resultCount} results (top: ${topSim}) ${latency_ms}ms${statusStr}`)
  }

  const evalDuration = Date.now() - evalStart
  const scorecard = aggregateScores(results, thresholds)

  const report: EvalReport = {
    metadata: {
      slug: slug!,
      date: new Date().toISOString().split('T')[0],
      base_url: BASE_URL,
      match_threshold: 0.70, // from query route constant
      eval_set_path: evalSetPath,
      duration_ms: evalDuration,
    },
    scorecard,
    results,
  }

  printScorecard(report, thresholds, verbose)
  const filepath = writeReport(report)

  // Exit with error code if thresholds not met
  if (!scorecard.pass) {
    console.log(`Exit code 1 — ${scorecard.threshold_failures.length} threshold(s) failed`)
    process.exit(1)
  }
}

runEval().catch(err => {
  console.error('Eval runner failed:', err)
  process.exit(2)
})
