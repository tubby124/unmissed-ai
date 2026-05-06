import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const CID = 'bff9d635-436f-44a6-a84a-5e143fff7c18'

async function main() {
  const { data: pv, error: pvErr } = await svc
    .from('prompt_versions')
    .select('*')
    .eq('client_id', CID)
    .order('version', { ascending: false })
    .limit(5)
  console.log('=== prompt_versions ===')
  console.log('error:', pvErr?.message)
  console.log('count:', pv?.length ?? 0)
  for (const v of pv ?? []) {
    const r = v as Record<string, unknown>
    console.log(`  v${r.version} (${r.created_at}) id=${r.id}`)
    const text = (r.system_prompt_text ?? r.system_prompt ?? '') as string
    console.log(`    char_length=${text.length}`)
    console.log(`    notes=${r.notes ?? r.note ?? '—'}`)
  }

  const { data: client } = await svc
    .from('clients')
    .select('tools, system_prompt, last_agent_sync_status, last_agent_sync_at, last_agent_synced_at, last_agent_sync_error')
    .eq('id', CID)
    .single()
  const c = client as Record<string, unknown>
  const tools = c.tools as Record<string, unknown>[]
  console.log('')
  console.log('=== current clients.tools ===')
  for (const t of tools ?? []) {
    const tn = (t.toolName as string | undefined) ||
      ((t.temporaryTool as Record<string, unknown> | undefined)?.modelToolName as string | undefined) ||
      (t.toolId ? `<tool by id: ${t.nameOverride ?? '?'}>` : '?')
    console.log(`  - ${tn}`)
  }
  console.log('')
  console.log('=== sync state ===')
  console.log(`  last_agent_sync_status: ${c.last_agent_sync_status}`)
  console.log(`  last_agent_sync_at:     ${c.last_agent_sync_at}`)
  console.log(`  last_agent_synced_at:   ${c.last_agent_synced_at}`)
  console.log(`  last_agent_sync_error:  ${c.last_agent_sync_error}`)
  console.log(`  current system_prompt:  ${(c.system_prompt as string).length} chars`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
