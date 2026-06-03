// Snapshot Brian's dryrun output with ONLY the Bug 3 fix applied (Option C cherry-pick).
// Writes to tests/promptfoo/snapshots/brian-bug3-only-2026-06-02.txt for promptfoo eval.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
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
  const out = 'tests/promptfoo/snapshots/brian-bug3-only-2026-06-02.txt'
  fs.writeFileSync(out, newPrompt)
  console.log(`current chars: ${(client.system_prompt as string).length}`)
  console.log(`bug3-only chars: ${newPrompt.length}`)
  console.log(`delta: ${newPrompt.length - (client.system_prompt as string).length}`)
  console.log(`wrote ${out}`)
}
main().catch(e => { console.error(e); process.exit(1) })
