import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
async function main() {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await svc.from('clients').select('system_prompt, niche, hand_tuned, ultravox_agent_id').eq('slug','velly-remodeling').single()
  if (error || !data) { console.error('Error:', error); process.exit(1) }
  fs.writeFileSync('/tmp/velly-LIVE-POST-DEPLOY.txt', data.system_prompt as string)
  console.log(`niche=${data.niche} hand_tuned=${data.hand_tuned} prompt=${(data.system_prompt as string).length} chars`)
  console.log(`ultravox_agent_id=${data.ultravox_agent_id}`)
}
main()
