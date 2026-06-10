#!/usr/bin/env tsx
/**
 * build-niche-baseline.ts
 *
 * Substitutes {{PLACEHOLDER}} markers in tests/promptfoo/niche-templates/_universal.yaml
 * + (optionally) a per-niche template, and concatenates them into a single runnable
 * promptfoo baseline YAML for a specific client.
 *
 * Pure substitution + concatenation. No DB reads. No Ultravox calls. No client touch.
 * Output is local-only — written to tests/promptfoo/<slug>-baseline.yaml.
 *
 * Usage:
 *   npx tsx scripts/build-niche-baseline.ts \
 *     --slug velly-remodeling \
 *     --niche home_renovation \
 *     --business-name "Velly Remodeling" \
 *     --close-person "Eric" \
 *     --service-area-primary "Calgary" \
 *     --service-area-secondary "Calgary" \
 *     --hours-display "Monday-Friday 8am-5pm" \
 *     --hours-keywords '["Monday","Friday","8","5","9","weekday"]' \
 *     --niche-keywords '["renovation","remodel","kitchen","bathroom","contractor","home reno"]' \
 *     --snapshot-path "/tmp/velly-slot-output.txt"
 *
 * Then run:
 *   npx promptfoo eval -c tests/promptfoo/velly-remodeling-baseline.yaml
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface Args {
  slug: string
  niche: string
  businessName: string
  closePerson: string
  serviceAreaPrimary: string
  serviceAreaSecondary: string
  hoursDisplay: string
  hoursKeywords: string  // JSON array literal as string
  nicheKeywords: string  // JSON array literal as string
  snapshotPath: string
  today?: string
  currentTime?: string
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string, required = true): string => {
    const i = argv.indexOf(flag)
    if (i === -1 || i === argv.length - 1) {
      if (required) {
        console.error(`Missing required flag: ${flag}`)
        process.exit(1)
      }
      return ''
    }
    return argv[i + 1]
  }
  return {
    slug: get('--slug'),
    niche: get('--niche'),
    businessName: get('--business-name'),
    closePerson: get('--close-person'),
    serviceAreaPrimary: get('--service-area-primary'),
    serviceAreaSecondary: get('--service-area-secondary'),
    hoursDisplay: get('--hours-display'),
    hoursKeywords: get('--hours-keywords'),
    nicheKeywords: get('--niche-keywords'),
    snapshotPath: get('--snapshot-path'),
    today: get('--today', false) || new Date().toISOString().slice(0, 10),
    currentTime: get('--current-time', false) || new Date().toTimeString().slice(0, 5),
  }
}

function substitute(text: string, args: Args): string {
  return text
    .replace(/\{\{SLUG\}\}/g, args.slug)
    .replace(/\{\{BUSINESS_NAME\}\}/g, args.businessName)
    .replace(/\{\{CLOSE_PERSON\}\}/g, args.closePerson)
    .replace(/\{\{SERVICE_AREA_PRIMARY\}\}/g, args.serviceAreaPrimary)
    .replace(/\{\{SERVICE_AREA_SECONDARY\}\}/g, args.serviceAreaSecondary)
    .replace(/\{\{OFFICE_HOURS_DISPLAY\}\}/g, args.hoursDisplay)
    .replace(/\{\{OFFICE_HOURS_KEYWORDS\}\}/g, args.hoursKeywords)
    .replace(/\{\{NICHE_DOMAIN_KEYWORDS\}\}/g, args.nicheKeywords)
    .replace(/\{\{SNAPSHOT_PATH\}\}/g, args.snapshotPath)
    .replace(/\{\{TODAY\}\}/g, args.today!)
    .replace(/\{\{CURRENT_TIME\}\}/g, args.currentTime!)
}

/**
 * Extract the `tests:` section from a substituted YAML, returning just the
 * list items (everything after the `tests:` line up to end-of-file).
 *
 * We keep the file-header (providers/prompts/defaultTest) from _universal only.
 */
function extractTestsBody(yaml: string): string {
  const lines = yaml.split('\n')
  const testsIdx = lines.findIndex(l => l.match(/^tests:\s*$/))
  if (testsIdx === -1) {
    throw new Error('Could not find `tests:` line in YAML — file structure changed?')
  }
  return lines.slice(testsIdx + 1).join('\n')
}

function main() {
  const args = parseArgs()
  const repoRoot = join(__dirname, '..')
  const universalPath = join(repoRoot, 'tests/promptfoo/niche-templates/_universal.yaml')
  const nichePath = join(repoRoot, `tests/promptfoo/niche-templates/${args.niche}.yaml`)
  const outPath = join(repoRoot, `tests/promptfoo/${args.slug}-baseline.yaml`)

  if (!existsSync(universalPath)) {
    console.error(`Universal template not found: ${universalPath}`)
    process.exit(1)
  }

  const universalRaw = readFileSync(universalPath, 'utf-8')
  const universalSub = substitute(universalRaw, args)

  let combinedTests = universalSub  // start with universal in full

  if (existsSync(nichePath)) {
    const nicheRaw = readFileSync(nichePath, 'utf-8')
    const nicheSub = substitute(nicheRaw, args)
    const nicheTestsBody = extractTestsBody(nicheSub)
    combinedTests = `${universalSub}\n\n  # ═══════════════════════════════════════════════════════════════════════\n  # NICHE-SPECIFIC SCENARIOS (${args.niche})\n  # ═══════════════════════════════════════════════════════════════════════\n${nicheTestsBody}`
  } else {
    console.warn(`[build-niche-baseline] No niche template for "${args.niche}" — using _universal.yaml only`)
  }

  // Update the description to include both layer counts
  combinedTests = combinedTests.replace(
    /^description:.*$/m,
    `description: "${args.businessName} — composed baseline (_universal + ${args.niche})"`,
  )

  writeFileSync(outPath, combinedTests, 'utf-8')

  const scenarioCount = (combinedTests.match(/^\s*- description:/gm) || []).length
  console.log(`✓ Wrote ${outPath}`)
  console.log(`  ${scenarioCount} scenarios composed`)
  console.log(`  Snapshot: ${args.snapshotPath}`)
  console.log()
  console.log(`Run with:`)
  console.log(`  npx promptfoo eval -c ${outPath}`)
}

main()
