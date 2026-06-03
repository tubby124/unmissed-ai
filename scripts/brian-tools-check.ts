// Check whether queryKnowledge is registered in Brian's clients.tools (runtime tool source).
// Read-only.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'

async function main(): Promise<void> {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: client } = await svc.from('clients').select('tools, knowledge_backend, ultravox_agent_id').eq('id', CLIENT_ID).single()
  if (!client) throw new Error('not found')
  const tools = Array.isArray(client.tools) ? client.tools : []
  console.log(`knowledge_backend: ${client.knowledge_backend}`)
  console.log(`ultravox_agent_id: ${client.ultravox_agent_id}`)
  console.log(`clients.tools count: ${tools.length}`)
  console.log('\n=== Tools registered ===')
  for (const t of tools) {
    const name = (t as any).toolName || (t as any).nameOverride || (t as any).temporaryTool?.modelToolName || '?'
    console.log(`- ${name}`)
  }
  const hasKB = tools.some((t: any) => {
    const name = t.toolName || t.nameOverride || t.temporaryTool?.modelToolName || ''
    return name === 'queryKnowledge'
  })
  console.log(`\nqueryKnowledge registered: ${hasKB ? '✓ YES' : '✗ NO'}`)
  if (!hasKB) {
    console.log('→ ROOT CAUSE: tool not in clients.tools. buildAgentTools() may have skipped it.')
    console.log('  Fix: run /api/dashboard/knowledge/compile/apply OR syncClientTools() to rebuild.')
  } else {
    console.log('→ Tool IS registered. Routing bug is in PROMPT wording, not registration.')
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
