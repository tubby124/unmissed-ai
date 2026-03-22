import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * S18k: Cron method parity test.
 *
 * Reads railway.json cron config and verifies each cron route file exports
 * the matching HTTP method. Prevents S12-V8-BUG1 class bugs where a route
 * exports GET but railway.json sends POST (or vice versa), causing the cron
 * to silently 405 for weeks.
 */

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')
const RAILWAY_JSON_PATH = path.join(PROJECT_ROOT, 'railway.json')
const CRON_ROUTES_DIR = path.join(PROJECT_ROOT, 'src', 'app', 'api', 'cron')

interface CronEntry {
  schedule: string
  command: string
}

interface ParsedCron {
  routeName: string
  expectedMethod: string
  schedule: string
}

function parseCronEntries(): ParsedCron[] {
  const raw = fs.readFileSync(RAILWAY_JSON_PATH, 'utf-8')
  const config = JSON.parse(raw)
  const crons: CronEntry[] = config.cron

  assert.ok(Array.isArray(crons) && crons.length > 0, 'railway.json should have at least one cron entry')

  return crons.map((entry) => {
    // Extract route name from the URL in the curl command
    // e.g., "curl -s -X POST http://localhost:3000/api/cron/analyze-calls ..."
    const urlMatch = entry.command.match(/\/api\/cron\/([\w-]+)/)
    assert.ok(urlMatch, `Could not extract cron route name from command: ${entry.command}`)
    const routeName = urlMatch[1]

    // Determine expected HTTP method from the curl command
    // -X POST means POST; no -X flag means GET (curl default)
    const methodMatch = entry.command.match(/-X\s+(GET|POST|PUT|PATCH|DELETE)/)
    const expectedMethod = methodMatch ? methodMatch[1] : 'GET'

    return { routeName, expectedMethod, schedule: entry.schedule }
  })
}

function getExportedMethod(routeFilePath: string): string | null {
  const content = fs.readFileSync(routeFilePath, 'utf-8')
  // Match: export async function GET/POST/etc or export function GET/POST/etc
  const match = content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/)
  return match ? match[1] : null
}

describe('Cron method parity (railway.json vs route exports)', () => {
  const entries = parseCronEntries()

  for (const entry of entries) {
    it(`${entry.routeName}: railway.json expects ${entry.expectedMethod} (schedule: ${entry.schedule})`, () => {
      const routeFile = path.join(CRON_ROUTES_DIR, entry.routeName, 'route.ts')

      assert.ok(
        fs.existsSync(routeFile),
        `Route file not found: ${routeFile}. ` +
        `railway.json references /api/cron/${entry.routeName} but no route.ts exists.`
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
        `but railway.json expects ${entry.expectedMethod}. ` +
        `This causes a silent 405 on every cron invocation (see S12-V8-BUG1).`
      )
    })
  }

  it('every cron route file has a matching railway.json entry', () => {
    const scheduledRoutes = new Set(entries.map((e) => e.routeName))

    // Read actual directories under src/app/api/cron/
    const cronDirs = fs.readdirSync(CRON_ROUTES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => fs.existsSync(path.join(CRON_ROUTES_DIR, d.name, 'route.ts')))
      .map((d) => d.name)

    const unscheduled = cronDirs.filter((dir) => !scheduledRoutes.has(dir))

    assert.equal(
      unscheduled.length,
      0,
      `Cron route(s) exist but have no railway.json schedule: [${unscheduled.join(', ')}]. ` +
      `These routes are dead code — they will never be called. ` +
      `Either add a schedule to railway.json or delete the route.`
    )
  })
})
