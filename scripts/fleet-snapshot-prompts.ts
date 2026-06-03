// P3 — Snapshot all 4 active client prompts for fleet-wide promptfoo harness runs.
// Reads from DB, writes to tests/promptfoo/snapshots/. Read-only.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const CLIENTS = [
  { slug: 'calgary-property-leasing', owner: 'brian', niche: 'property_management' },
  { slug: 'urban-vibe', owner: 'ray', niche: 'property_management' },
  { slug: 'hasan-sharif', owner: 'hasan', niche: 'real_estate' },
  { slug: 'exp-realty', owner: 'omar', niche: 'real_estate' },
]

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const outDir = 'tests/promptfoo/snapshots'
  fs.mkdirSync(outDir, { recursive: true })

  console.log('| Slug | Owner | Niche | Prompt chars | Has slot markers | hand_tuned |')
  console.log('|---|---|---|---:|:---:|:---:|')

  for (const c of CLIENTS) {
    const { data: client } = await svc.from('clients').select('id, slug, business_name, agent_name, system_prompt, hand_tuned, niche, knowledge_backend').eq('slug', c.slug).single()
    if (!client) {
      console.log(`| ${c.slug} | ${c.owner} | ${c.niche} | NOT FOUND | - | - |`)
      continue
    }
    const prompt = (client.system_prompt as string) || ''
    const hasSlots = /<!--\s*unmissed:/.test(prompt)
    const outPath = path.join(outDir, `${c.slug}-current-2026-06-02.txt`)
    fs.writeFileSync(outPath, prompt)
    console.log(`| ${c.slug} | ${client.agent_name} | ${client.niche} | ${prompt.length} | ${hasSlots ? '✓' : '✗'} | ${(client as any).hand_tuned ? '✓' : '✗'} |`)
  }
  console.log(`\nSnapshots in ${outDir}/`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
