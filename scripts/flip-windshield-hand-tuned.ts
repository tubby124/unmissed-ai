import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const SLUG = 'windshield-hub'
  const { data: pre } = await svc.from('clients').select('id, hand_tuned, system_prompt').eq('slug', SLUG).single()
  const p = pre as Record<string, unknown>
  console.log(`pre  hand_tuned=${p.hand_tuned}  system_prompt=${(p.system_prompt as string).length} chars`)

  if (p.hand_tuned === false) { console.log('already false. nothing to do.'); return }

  const { error } = await svc.from('clients').update({ hand_tuned: false }).eq('slug', SLUG)
  if (error) throw error

  const { data: post } = await svc.from('clients').select('hand_tuned, system_prompt').eq('slug', SLUG).single()
  const q = post as Record<string, unknown>
  console.log(`post hand_tuned=${q.hand_tuned}  system_prompt=${(q.system_prompt as string).length} chars (untouched)`)
  console.log('✅ flipped — Mark is now self-serve. Dashboard edits will auto-regenerate the right slot section on next save.')
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
