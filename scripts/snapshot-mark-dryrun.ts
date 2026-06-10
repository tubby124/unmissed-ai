import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main() {
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, hand_tuned, system_prompt')
    .eq('slug', 'windshield-hub')
    .limit(1)
    .maybeSingle()
  if (!client) throw new Error('not found')

  const { data: adminCu } = await svc
    .from('client_users').select('user_id').eq('role', 'admin').limit(1).maybeSingle()
  if (!adminCu?.user_id) throw new Error('no admin')

  const result = await recomposePrompt(client.id, adminCu.user_id, true, false)
  if (result.preview) {
    process.stdout.write(result.preview)
  } else if (client.system_prompt) {
    // Fall back to current DB prompt
    process.stdout.write(client.system_prompt)
  } else {
    throw new Error('no preview and no DB prompt')
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
