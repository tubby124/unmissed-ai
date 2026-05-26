#!/usr/bin/env tsx
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  buildClientTimelineReport,
  formatClientTimelineMarkdown,
} from '../src/lib/client-timeline-report'

dotenvConfig({ path: '.env.local', quiet: true })

interface Args {
  slug?: string
  since?: string
  json: boolean
  help: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false, help: false }
  for (const arg of argv) {
    if (arg === '--json') args.json = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg.startsWith('--slug=')) args.slug = arg.slice('--slug='.length)
    else if (arg.startsWith('--since=')) args.since = arg.slice('--since='.length)
  }
  return args
}

function usage(): string {
  return [
    'Usage:',
    '  npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif',
    '  npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif --json',
    '  npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif --since=2026-05-01',
  ].join('\n')
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }
  if (!args.slug) throw new Error(`Missing --slug\n${usage()}`)

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  const report = await buildClientTimelineReport(supabase, {
    slug: args.slug,
    since: args.since,
  })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(formatClientTimelineMarkdown(report))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
