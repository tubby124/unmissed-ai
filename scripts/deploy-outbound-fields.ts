/**
 * scripts/deploy-outbound-fields.ts
 *
 * Deploy structured outbound prompt fields from a JSON file into the
 * clients row (outbound_goal/opening/vm_script/tone + assembled
 * outbound_prompt). Outbound-only — never touches system_prompt or the
 * inbound Ultravox agent (no-redeploy rule stays intact).
 *
 * Usage:
 *   npx tsx scripts/deploy-outbound-fields.ts --slug hasan-sharif \
 *     --fields clients/hasan-sharif/outbound-lead-qual.json [--webhook-url https://...]
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { assembleOutboundPrompt, type OutboundPromptFields, type OutboundTone } from '../src/lib/outbound-prompt-builder'

config({ path: '.env.local' })

function arg(flag: string, dflt?: string): string | undefined {
  const args = process.argv.slice(2)
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}

async function main() {
  const slug = arg('--slug')
  const fieldsPath = arg('--fields')
  const webhookUrl = arg('--webhook-url')
  if (!slug || !fieldsPath) {
    console.error('Usage: --slug <slug> --fields <path.json> [--webhook-url <url>]')
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(resolve(fieldsPath), 'utf8')) as OutboundPromptFields
  const fields: OutboundPromptFields = {
    goal: raw.goal,
    tone: raw.tone as OutboundTone,
    opening: raw.opening,
    vmScript: raw.vmScript,
    callNotes: raw.callNotes ?? null,
    specialInstructions: raw.specialInstructions ?? null,
  }
  const assembled = assembleOutboundPrompt(fields)

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const update: Record<string, string> = {
    outbound_prompt: assembled,
    outbound_goal: fields.goal,
    outbound_opening: fields.opening,
    outbound_vm_script: fields.vmScript,
    outbound_tone: fields.tone,
  }
  if (webhookUrl) update.lead_webhook_url = webhookUrl

  const { data, error } = await svc.from('clients').update(update).eq('slug', slug).select('id, slug')
  if (error) {
    console.error('Deploy failed:', error.message)
    process.exit(1)
  }
  if (!data?.length) {
    console.error(`No client with slug=${slug}`)
    process.exit(1)
  }
  console.log(`Deployed outbound fields to ${slug} (${assembled.length} chars)${webhookUrl ? ` + lead_webhook_url=${webhookUrl}` : ''}`)
}

main()
