/**
 * record-promptfoo-findings.ts — wrapper around `promptfoo eval` that:
 *   1. Runs `promptfoo eval -c <config>` with `--output <tmp>.json` (capture
 *      structured results regardless of whether stdout was a TTY).
 *   2. Parses the JSON output for failing tests + failing assertions.
 *   3. Calls recordFindings() so /dashboard/admin/harness sees the run.
 *
 * Why this exists (not a hook in the YAML): promptfoo's YAML config doesn't
 * support post-eval hooks. The shell-wrapper pattern keeps the upstream YAML
 * unchanged and works for any of the promptfoo configs we want to gate on the
 * dashboard.
 *
 * Usage:
 *   tsx tests/promptfoo/scripts/record-promptfoo-findings.ts \
 *     --config tests/promptfoo/ultravox-hasan-greeting-eval.yaml \
 *     [--harness-tag <slug>]
 *
 * Exit code: passes through promptfoo's exit code. Writing to harness_findings
 * NEVER fails the run on its own (we still want the eval signal).
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { recordFindings, type Finding as HarnessFinding } from '../../../src/lib/harness-writer.js'

interface CliArgs {
  config: string
  harnessTag: string
}

function parseArgs(argv: string[]): CliArgs {
  let config = ''
  let harnessTag = ''
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if ((a === '--config' || a === '-c') && i + 1 < argv.length) {
      config = argv[++i]
    } else if (a === '--harness-tag' && i + 1 < argv.length) {
      harnessTag = argv[++i]
    }
  }
  if (!config) {
    console.error('Usage: record-promptfoo-findings --config <yaml> [--harness-tag <slug>]')
    process.exit(2)
  }
  if (!harnessTag) {
    // Derive a stable tag from the config filename so multiple promptfoo
    // configs don't collide on the same check_name.
    harnessTag = basename(config).replace(/\.ya?ml$/, '')
  }
  return { config, harnessTag }
}

interface PromptfooAssertion {
  pass?: boolean
  score?: number
  reason?: string
  type?: string
  value?: unknown
}

interface PromptfooTestResult {
  description?: string
  prompt?: { display?: string; raw?: string }
  vars?: Record<string, unknown>
  response?: { output?: string; error?: string }
  success?: boolean
  failureReason?: string
  gradingResult?: {
    pass?: boolean
    componentResults?: PromptfooAssertion[]
    reason?: string
  }
}

interface PromptfooReport {
  results?: {
    results?: PromptfooTestResult[]
    stats?: { successes?: number; failures?: number }
  }
  evalId?: string
}

function buildFindings(report: PromptfooReport, harnessTag: string): HarnessFinding[] {
  const out: HarnessFinding[] = []
  const tests = report.results?.results ?? []
  for (const t of tests) {
    if (t.success !== false) continue
    const failedAssertions: string[] = []
    for (const c of t.gradingResult?.componentResults ?? []) {
      if (c.pass === false) {
        const v = typeof c.value === 'string' ? c.value : JSON.stringify(c.value)
        failedAssertions.push(`[${c.type ?? '?'}] ${v?.slice(0, 80) ?? ''} — ${c.reason?.slice(0, 80) ?? ''}`)
      }
    }
    const desc = t.description ?? '(unnamed test)'
    const reason = t.failureReason ?? t.gradingResult?.reason ?? 'eval failed'
    const checkName = `${harnessTag}::${slugify(desc)}`.slice(0, 80)
    out.push({
      check_name: checkName,
      // Promptfoo regressions are P1 (silent fakery class — agent drifted but
      // still answered the phone). Override per-config if you need different.
      severity: 'P1',
      client_slug: null,
      summary: `${desc}: ${reason}`.slice(0, 280),
      details: {
        harness_tag: harnessTag,
        description: desc,
        reason,
        failed_assertions: failedAssertions,
        output_excerpt: (t.response?.output ?? '').slice(0, 400),
        response_error: t.response?.error ?? null,
        eval_id: report.evalId ?? null,
      },
    })
  }
  return out
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'test'
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))

  // Create a tmp file for promptfoo's JSON output. promptfoo writes the
  // complete eval result here regardless of TTY, so we can parse it reliably.
  const tmpDir = mkdtempSync(join(tmpdir(), 'promptfoo-'))
  const outPath = join(tmpDir, 'eval.json')

  console.log(`[record-promptfoo-findings] running: npx promptfoo eval -c ${args.config} --output ${outPath}`)
  const child = spawnSync('npx', ['promptfoo', 'eval', '-c', args.config, '--output', outPath], {
    stdio: 'inherit',
    env: process.env,
  })

  const exit = child.status ?? 1
  console.log(`[record-promptfoo-findings] promptfoo exit=${exit}`)

  // Parse + record regardless of exit code — promptfoo exits 100 on test
  // failures and we WANT those in the dashboard.
  let report: PromptfooReport | null = null
  try {
    const raw = readFileSync(outPath, 'utf-8')
    report = JSON.parse(raw) as PromptfooReport
  } catch (err) {
    console.warn(`[record-promptfoo-findings] could not read ${outPath}: ${(err as Error).message}`)
  }

  if (report) {
    const findings = buildFindings(report, args.harnessTag)
    if (findings.length === 0) {
      console.log('[record-promptfoo-findings] no failing tests')
    } else {
      const runId = process.env.GITHUB_RUN_ID ?? String(Date.now())
      try {
        const res = await recordFindings({ harness: 'promptfoo', run_id: runId, findings })
        console.log(`[record-promptfoo-findings] harness_findings: wrote=${res.written} reopened=${res.reopened} errors=${res.errors.length}`)
        for (const e of res.errors) console.error(`  [recordFindings] ${e}`)
      } catch (err) {
        console.error('[record-promptfoo-findings] recordFindings failed (continuing):', err)
      }
    }
  }

  // Clean up tmp dir
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // best-effort
  }

  return exit
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[record-promptfoo-findings] fatal:', err)
    process.exit(2)
  })
