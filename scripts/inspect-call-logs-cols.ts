import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await svc.from('call_logs').select('*').eq('client_id', '2c186f70-84cc-4253-a3ab-6cd0e9064d39').order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) { console.error(error); process.exit(1) }
  if (!data) { console.log('no rows'); return }
  for (const k of Object.keys(data).sort()) {
    const v = (data as any)[k]
    const t = v === null ? 'null' : Array.isArray(v) ? `array[${v.length}]` : typeof v
    const preview = v === null ? '' : typeof v === 'string' ? `: "${v.slice(0, 60)}"` : t === 'object' ? `: ${JSON.stringify(v).slice(0, 80)}` : `: ${v}`
    console.log(`${k.padEnd(40)} ${t.padEnd(10)} ${preview}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
