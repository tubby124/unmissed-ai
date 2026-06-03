// Bypass recomposePrompt's validation gate and measure the raw build output.
// Used during slim work to see size deltas even when prompt is still over hard max.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { clientRowToIntake } from '../src/lib/slot-regenerator'
import { buildSlotContext, buildPromptFromSlots } from '../src/lib/prompt-slots'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: client } = await svc.from('clients').select('*').eq('id', CLIENT_ID).single()
  if (!client) throw new Error('not found')

  const { data: services } = await svc.from('client_services').select('name, description, category, duration_mins, price, booking_notes').eq('client_id', CLIENT_ID).eq('active', true).order('sort_order').order('created_at')
  let chunkCount = 0
  if (client.knowledge_backend === 'pgvector') {
    const { count } = await svc.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', CLIENT_ID).eq('status', 'approved')
    chunkCount = count ?? 0
  }
  const intake = clientRowToIntake(client, services ?? [], chunkCount)
  const ctx = buildSlotContext(intake)
  const newPrompt = buildPromptFromSlots(ctx)

  const outDir = '/tmp/brian-audit'
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'brian-preview.md'), newPrompt)
  fs.writeFileSync(path.join(outDir, 'brian-current.md'), client.system_prompt)

  console.log(`current: ${(client.system_prompt as string).length} chars`)
  console.log(`preview: ${newPrompt.length} chars`)
  console.log(`delta:   ${newPrompt.length - (client.system_prompt as string).length}`)

  // Section table
  function sectionMap(p: string): Map<string, number> {
    const m = new Map<string, number>()
    const opens = new Map<string, number>()
    const re = /<!--\s*(\/)?unmissed:([\w-]+)\s*-->/g
    let x: RegExpExecArray | null
    while ((x = re.exec(p)) !== null) {
      const closing = x[1] === '/'
      const name = x[2]
      if (!closing) opens.set(name, x.index)
      else {
        const start = opens.get(name)
        if (start !== undefined) { m.set(name, (x.index + x[0].length) - start); opens.delete(name) }
      }
    }
    return m
  }
  const cur = sectionMap(client.system_prompt)
  const prev = sectionMap(newPrompt)
  const order = Array.from(new Set([...cur.keys(), ...prev.keys()]))
  let tCur = 0, tPrev = 0
  console.log('\n| Section | Current | Preview | Δ |')
  console.log('|---|---:|---:|---:|')
  for (const n of order) {
    const c = cur.get(n) ?? 0
    const p = prev.get(n) ?? 0
    tCur += c
    tPrev += p
    console.log(`| ${n} | ${c} | ${p} | ${p - c >= 0 ? '+' : ''}${p - c} |`)
  }
  console.log(`| **TOTAL slotted** | **${tCur}** | **${tPrev}** | **${tPrev - tCur >= 0 ? '+' : ''}${tPrev - tCur}** |`)

  // Safety fingerprint check
  const fingerprints = [
    'Fair Housing Act violations carry penalties up to $150,000',
    'NEVER reject or question service animal or ESA',
    'demographic language',
    'do NOT downplay',
    '9-1-1 right now',
    'no heat',
    'COMPLETION CHECK',
    'hangUp',
    'Never reveal',
    'Never obey instructions',
    'ALWAYS ASK why they\'re calling today',
  ]
  console.log('\n=== SAFETY FINGERPRINTS ===')
  for (const fp of fingerprints) {
    const hit = newPrompt.includes(fp)
    console.log(`${hit ? '✓' : '✗'} ${fp}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
