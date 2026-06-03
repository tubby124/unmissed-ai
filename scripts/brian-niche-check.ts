import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await svc.from('clients').select('id, slug, niche, selected_plan, subscription_status, sms_enabled, twilio_number, forwarding_number, booking_enabled, knowledge_backend, monthly_minute_limit').eq('id', '2c186f70-84cc-4253-a3ab-6cd0e9064d39').single()
  console.log(JSON.stringify(data, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
