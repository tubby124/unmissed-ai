import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Cron method parity test (post-c166701).
 *
 * Crons migrated from railway.json (removed) to .github/workflows/crons.yml.
 * The workflow dispatches each schedule to a `call <route-name> <METHOD>` bash
 * helper. This test ensures every dispatched (name, method) pair maps to a
 * route file that actually exports the matching HTTP method — and that every
 * route directory has at least one workflow dispatch entry.
 *
 * Catches the S12-V8-BUG1 class: workflow says POST, route exports GET, every
 * fire silently 405s until somebody notices revenue stopped flowing.
 */

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const CRONS_YML_PATH = path.join(PROJECT_ROOT, '.github', 'workflows', 'crons.yml')
const CRON_ROUTES_DIR = path.join(PROJECT_ROOT, 'src', 'app', 'api', 'cron')

interface ParsedCron {
  routeName: string
  expectedMethod: string
}

function parseCronEntries(): ParsedCron[] {
  assert.ok(fs.existsSync(CRONS_YML_PATH), `crons.yml not found at ${CRONS_YML_PATH}`)
  const raw = fs.readFileSync(CRONS_YML_PATH, 'utf-8')

  const callRe = /\bcall\s+([a-z][a-z0-9-]+)\s+(GET|POST|PUT|PATCH|DELETE)\b/g
  const seen = new Map<string, string>()
  let m: RegExpExecArray | null
  while ((m = callRe.exec(raw)) !== null) {
    const [, name, method] = m
    const existing = seen.get(name)
    if (existing && existing !== method) {
      throw new Error(
        `crons.yml dispatches ${name} with conflicting methods: ${existing} and ${method}. ` +
        `Pick one — the route only exports one HTTP method.`
      )
    }
    seen.set(name, method)
  }

  assert.ok(seen.size > 0, 'crons.yml should dispatch at least one cron route via `call <name> <METHOD>`')
  return [...seen.entries()].map(([routeName, expectedMethod]) => ({ routeName, expectedMethod }))
}

function getExportedMethod(routeFilePath: string): string | null {
  const content = fs.readFileSync(routeFilePath, 'utf-8')
  const match = content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/)
  return match ? match[1] : null
}

describe('Cron method parity (crons.yml vs route exports)', () => {
  const entries = parseCronEntries()

  for (const entry of entries) {
    it(`${entry.routeName}: crons.yml dispatches ${entry.expectedMethod}`, () => {
      const routeFile = path.join(CRON_ROUTES_DIR, entry.routeName, 'route.ts')

      assert.ok(
        fs.existsSync(routeFile),
        `Route file not found: ${routeFile}. ` +
        `crons.yml dispatches /api/cron/${entry.routeName} but no route.ts exists.`
      )

      const exportedMethod = getExportedMethod(routeFile)

      assert.ok(
        exportedMethod !== null,
        `${entry.routeName}/route.ts does not export any HTTP method function (GET, POST, etc). ` +
        `Expected: export async function ${entry.expectedMethod}`
      )

      assert.equal(
        exportedMethod,
        entry.expectedMethod,
        `METHOD MISMATCH: ${entry.routeName}/route.ts exports ${exportedMethod} ` +
        `but crons.yml dispatches ${entry.expectedMethod}. ` +
        `This causes a silent 405 on every cron invocation (see S12-V8-BUG1).`
      )
    })
  }

  it('every cron route directory is dispatched by crons.yml', () => {
    const dispatchedRoutes = new Set(entries.map((e) => e.routeName))

    const cronDirs = fs.readdirSync(CRON_ROUTES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => fs.existsSync(path.join(CRON_ROUTES_DIR, d.name, 'route.ts')))
      .map((d) => d.name)

    const undispatched = cronDirs.filter((dir) => !dispatchedRoutes.has(dir))

    assert.equal(
      undispatched.length,
      0,
      `Cron route(s) exist but are not dispatched by .github/workflows/crons.yml: [${undispatched.join(', ')}]. ` +
      `These routes are dead code — they will never be called. ` +
      `Either add a \`call ${undispatched[0] ?? '<name>'} <METHOD>\` entry to crons.yml or delete the route.`
    )
  })
})
