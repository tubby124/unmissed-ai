import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const AGENT_ID = '00652ba8-5580-4632-97be-0fd2090bbb71'
  const CID = 'bff9d635-436f-44a6-a84a-5e143fff7c18'

  const res = await fetch(`https://api.ultravox.ai/api/agents/${AGENT_ID}`, {
    headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
  })
  if (!res.ok) {
    console.error(`agent fetch failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const agent = await res.json() as Record<string, unknown>
  const callTemplate = agent.callTemplate as Record<string, unknown>
  const ultravoxPrompt = callTemplate.systemPrompt as string

  const { data: client } = await svc.from('clients').select('system_prompt, active_prompt_version_id').eq('id', CID).single()
  const dbPrompt = (client as Record<string, unknown>).system_prompt as string

  console.log(`DB system_prompt:        ${dbPrompt.length} chars`)
  console.log(`Ultravox systemPrompt:   ${ultravoxPrompt.length} chars`)
  console.log(`active_prompt_version_id: ${(client as Record<string, unknown>).active_prompt_version_id}`)

  // Check first marker presence (slot pipeline always starts with persona_anchor)
  const dbHasMarkers = dbPrompt.includes('<!-- unmissed:persona_anchor -->')
  const ultravoxHasMarkers = ultravoxPrompt.includes('<!-- unmissed:persona_anchor -->')
  console.log(`DB has slot markers:        ${dbHasMarkers}`)
  console.log(`Ultravox has slot markers:  ${ultravoxHasMarkers}`)

  // Check for templateContext placeholder (Ultravox uses {{callerContext}}, DB stores stripped version)
  const ultravoxHasPlaceholder = ultravoxPrompt.includes('{{callerContext}}')
  console.log(`Ultravox has {{callerContext}}: ${ultravoxHasPlaceholder}`)

  // Find the rendered prompt in Ultravox vs DB — Ultravox should have markers stripped
  const ultravoxStripped = ultravoxPrompt.replace(/<!-- \/?unmissed:[^>]+ -->/g, '').trim()
  const dbWithoutMarkers = dbPrompt.replace(/<!-- \/?unmissed:[^>]+ -->/g, '').trim()
  console.log(`DB without markers:       ${dbWithoutMarkers.length} chars`)
  console.log(`Ultravox without markers: ${ultravoxStripped.length} chars`)

  // Check for "Sabbir" mentions (should be 0 in new prompt)
  const dbSabbirCount = (dbPrompt.match(/Sabbir/g) || []).length
  const ultravoxSabbirCount = (ultravoxPrompt.match(/Sabbir/g) || []).length
  console.log(`"Sabbir" in DB:        ${dbSabbirCount} (expected 0)`)
  console.log(`"Sabbir" in Ultravox:  ${ultravoxSabbirCount} (expected 0)`)

  const dbTeamCount = (dbPrompt.match(/the team/g) || []).length
  const ultravoxTeamCount = (ultravoxPrompt.match(/the team/g) || []).length
  console.log(`"the team" in DB:      ${dbTeamCount}`)
  console.log(`"the team" in Ultravox: ${ultravoxTeamCount}`)

  console.log('')
  if (dbSabbirCount === 0 && ultravoxSabbirCount === 0 && ultravoxTeamCount > 0) {
    console.log('✅ MIGRATION CONFIRMED LIVE — Mark agent now uses slot-composed prompt with "the team" callback')
  } else {
    console.log('⚠️  Unexpected state — investigate before any test calls')
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
