/**
 * reporter.ts — Console output and JSON file writing for retrieval eval
 */

import * as fs from 'fs'
import * as path from 'path'
import type { EvalReport, EvalResult, Scorecard, Thresholds } from './types'
import { countVerdicts } from './scorer'

const RESULTS_DIR = path.join(__dirname, '..', 'results')

/**
 * Print the scorecard to console.
 */
export function printScorecard(report: EvalReport, thresholds: Thresholds, verbose: boolean): void {
  const { scorecard, metadata, results } = report

  console.log('')
  console.log(`=== Retrieval Eval: ${metadata.slug} ===`)
  console.log(`Date: ${metadata.date}`)
  console.log(`Base URL: ${metadata.base_url}`)
  console.log(`Questions: ${scorecard.total_questions}`)
  console.log(`Duration: ${metadata.duration_ms}ms`)
  console.log(`Match Threshold: ${metadata.match_threshold}`)
  console.log('')
  console.log('SCORES:')

  printMetric(
    'Retrieval Hit Rate',
    scorecard.retrieval_hit_rate,
    `>${(thresholds.retrieval_hit_rate_min * 100).toFixed(0)}%`,
    scorecard.retrieval_hit_rate >= thresholds.retrieval_hit_rate_min,
    countVerdicts(results, 'retrieval_hit'),
  )
  printMetric(
    'Wrong Source Rate',
    scorecard.wrong_source_rate,
    `<${(thresholds.wrong_source_rate_max * 100).toFixed(0)}%`,
    scorecard.wrong_source_rate <= thresholds.wrong_source_rate_max,
    countVerdicts(results, 'wrong_source'),
    true,
  )
  printMetric(
    'Empty Result Rate',
    scorecard.empty_result_rate,
    `<${(thresholds.empty_result_rate_max * 100).toFixed(0)}%`,
    scorecard.empty_result_rate <= thresholds.empty_result_rate_max,
    countVerdicts(results, 'empty_when_should_have'),
    true,
  )
  printMetric(
    'Unnecessary Tool Rate',
    scorecard.unnecessary_tool_rate,
    `<${(thresholds.unnecessary_tool_rate_max * 100).toFixed(0)}%`,
    scorecard.unnecessary_tool_rate <= thresholds.unnecessary_tool_rate_max,
    countVerdicts(results, 'unnecessary_call'),
    true,
  )
  printMetric(
    'Correct Silence Rate',
    scorecard.correct_silence_rate,
    `>${(thresholds.correct_silence_rate_min * 100).toFixed(0)}%`,
    scorecard.correct_silence_rate >= thresholds.correct_silence_rate_min,
    countVerdicts(results, 'correct_silence'),
  )

  console.log(`  Latency p50:          ${pad(scorecard.latency_p50 + 'ms', 8)} [target: <${thresholds.latency_p50_max}ms]  ${scorecard.latency_p50 <= thresholds.latency_p50_max ? 'PASS' : 'FAIL'}`)
  console.log(`  Latency p95:          ${pad(scorecard.latency_p95 + 'ms', 8)} [target: <${thresholds.latency_p95_max}ms] ${scorecard.latency_p95 <= thresholds.latency_p95_max ? 'PASS' : 'FAIL'}`)
  console.log(`  Latency max:          ${scorecard.latency_max}ms`)
  console.log('')

  if (scorecard.pass) {
    console.log(`OVERALL: PASS (all thresholds met)`)
  } else {
    console.log(`OVERALL: FAIL (${scorecard.threshold_failures.length} threshold(s) breached)`)
    for (const f of scorecard.threshold_failures) {
      console.log(`  - ${f}`)
    }
  }
  console.log('')

  // Print per-question failures
  const failures = getFailedQuestions(results)
  if (failures.length > 0) {
    console.log(`QUESTION FAILURES (${failures.length}):`)
    for (const f of failures) {
      console.log(`  ${f.id}: ${f.reasons.join(', ')}`)
      if (verbose) {
        console.log(`    Q: "${f.result.question}"`)
        console.log(`    Results: ${f.result.response?.count ?? 0} (top sim: ${f.result.response?.results?.[0]?.similarity?.toFixed(3) ?? 'n/a'})`)
        if (f.result.response?.results?.length) {
          for (const r of f.result.response.results.slice(0, 2)) {
            console.log(`    -> [${r.chunk_type}] ${r.content.slice(0, 100)}... (${r.similarity.toFixed(3)})`)
          }
        }
      }
    }
    console.log('')
  }

  // Print category breakdown
  if (verbose) {
    printCategoryBreakdown(results)
  }
}

function printMetric(
  name: string,
  value: number,
  target: string,
  passes: boolean,
  counts: { pass: number; fail: number; total: number },
  invertedMetric = false,
): void {
  const pct = (value * 100).toFixed(1) + '%'
  const ratio = invertedMetric
    ? `(${counts.fail}/${counts.total})`
    : `(${counts.pass}/${counts.total})`
  console.log(`  ${pad(name + ':', 24)} ${pad(pct, 7)} ${pad(ratio, 8)} [target: ${target}]  ${passes ? 'PASS' : 'FAIL'}`)
}

function pad(s: string, len: number): string {
  return s.padEnd(len)
}

type QuestionFailure = {
  id: string
  reasons: string[]
  result: EvalResult
}

function getFailedQuestions(results: EvalResult[]): QuestionFailure[] {
  const failures: QuestionFailure[] = []

  for (const r of results) {
    const reasons: string[] = []
    const v = r.verdicts

    if (v.retrieval_hit === false) reasons.push('missed retrieval hit')
    if (v.wrong_source === true) reasons.push('wrong source returned')
    if (v.empty_when_should_have === true) reasons.push('empty result (answer exists)')
    if (v.unnecessary_call === true) reasons.push('unnecessary tool call (summary covers)')
    if (v.correct_silence === false) reasons.push('false positive (returned results for unanswerable)')

    if (reasons.length > 0) {
      failures.push({ id: r.id, reasons, result: r })
    }
  }

  return failures
}

function printCategoryBreakdown(results: EvalResult[]): void {
  const categories = new Map<string, EvalResult[]>()
  for (const r of results) {
    const cat = r.expected.category
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(r)
  }

  console.log('CATEGORY BREAKDOWN:')
  for (const [cat, catResults] of categories) {
    const hits = catResults.filter(r => r.verdicts.retrieval_hit === true).length
    const hitTotal = catResults.filter(r => r.verdicts.retrieval_hit !== null).length
    const empties = catResults.filter(r => r.verdicts.empty_when_should_have === true).length
    const avgLatency = Math.round(catResults.reduce((a, r) => a + r.latency_ms, 0) / catResults.length)
    console.log(`  ${pad(cat + ':', 16)} ${catResults.length} questions | hits: ${hits}/${hitTotal} | empties: ${empties} | avg latency: ${avgLatency}ms`)
  }
  console.log('')
}

/**
 * Write eval report to JSON file in results/ directory.
 */
export function writeReport(report: EvalReport): string {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }

  const filename = `${report.metadata.slug}-${report.metadata.date}.json`
  const filepath = path.join(RESULTS_DIR, filename)

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
  console.log(`Results written to: ${filepath}`)
  return filepath
}

/**
 * Compare two eval reports and print the diff.
 */
export function compareReports(older: EvalReport, newer: EvalReport): void {
  console.log('')
  console.log(`=== Comparison: ${older.metadata.date} -> ${newer.metadata.date} ===`)
  console.log(`Slug: ${newer.metadata.slug}`)
  console.log('')

  const metrics: Array<{ name: string; old: number; new: number; unit: string; lowerIsBetter: boolean }> = [
    { name: 'Retrieval Hit Rate', old: older.scorecard.retrieval_hit_rate, new: newer.scorecard.retrieval_hit_rate, unit: '%', lowerIsBetter: false },
    { name: 'Wrong Source Rate', old: older.scorecard.wrong_source_rate, new: newer.scorecard.wrong_source_rate, unit: '%', lowerIsBetter: true },
    { name: 'Empty Result Rate', old: older.scorecard.empty_result_rate, new: newer.scorecard.empty_result_rate, unit: '%', lowerIsBetter: true },
    { name: 'Unnecessary Tool Rate', old: older.scorecard.unnecessary_tool_rate, new: newer.scorecard.unnecessary_tool_rate, unit: '%', lowerIsBetter: true },
    { name: 'Correct Silence Rate', old: older.scorecard.correct_silence_rate, new: newer.scorecard.correct_silence_rate, unit: '%', lowerIsBetter: false },
    { name: 'Latency p50', old: older.scorecard.latency_p50, new: newer.scorecard.latency_p50, unit: 'ms', lowerIsBetter: true },
    { name: 'Latency p95', old: older.scorecard.latency_p95, new: newer.scorecard.latency_p95, unit: 'ms', lowerIsBetter: true },
  ]

  for (const m of metrics) {
    const isPercent = m.unit === '%'
    const oldVal = isPercent ? (m.old * 100).toFixed(1) : m.old.toString()
    const newVal = isPercent ? (m.new * 100).toFixed(1) : m.new.toString()
    const diff = isPercent ? ((m.new - m.old) * 100).toFixed(1) : (m.new - m.old).toFixed(0)
    const improved = m.lowerIsBetter ? m.new < m.old : m.new > m.old
    const arrow = m.new === m.old ? '=' : improved ? '+' : '-'
    console.log(`  ${pad(m.name + ':', 24)} ${oldVal}${m.unit} -> ${newVal}${m.unit}  (${arrow}${diff}${m.unit})`)
  }

  console.log('')
  console.log(`Overall: ${older.scorecard.pass ? 'PASS' : 'FAIL'} -> ${newer.scorecard.pass ? 'PASS' : 'FAIL'}`)
}
