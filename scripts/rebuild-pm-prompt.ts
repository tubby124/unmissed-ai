/**
 * One-off: build PM prompt for true-color-display-printing-ltd and push to Supabase + Ultravox.
 * If no intake_submissions row exists, creates a synthetic one first.
 * Run: npx tsx scripts/rebuild-pm-prompt.ts
 */
import { createClient } from '@supabase/supabase-js'
import { buildPromptFromIntake } from '../src/lib/prompt-builder'
import { updateAgent, buildAgentTools } from '../src/lib/ultravox'
import { clientToSyntheticIntake } from '../src/lib/client-to-synthetic-intake'
import * as fs from 'fs'

// Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
// Load ULTRAVOX_API_KEY from ~/.secrets
try {
  const secrets = fs.readFileSync(`${process.env.HOME}/.secrets`, 'utf-8')
  for (const line of secrets.split('\n')) {
    const m = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=["']?([^"'\s]+)["']?/)
    if (m) env[m[1]] = m[2]
  }
} catch {}

Object.assign(process.env, env)

const SLUG = 'true-color-display-printing-ltd'
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Get client
  const { data: client, error: cErr } = await svc.from('clients')
    .select('id, slug, niche, agent_name, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, twilio_number, knowledge_backend, transfer_conditions, system_prompt')
    .eq('slug', SLUG)
    .single()
  if (cErr || !client) throw new Error(`Client not found: ${cErr?.message}`)

  console.log(`Client: ${client.slug} | niche=${client.niche} | agent=${client.agent_name} | uvId=${client.ultravox_agent_id}`)

  // Check for intake, create synthetic if missing
  let { data: intake } = await svc.from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', SLUG)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!intake?.intake_json) {
    console.log('No intake found — creating synthetic intake from clients row...')
    const { payload } = await clientToSyntheticIntake(svc, client.id)

    // Add PM-specific niche answers inline so the prompt gets proper PM behavior
    const pmIntake = {
      ...payload,
      niche: 'property_management',
      nicheAnswers: {
        propertyTypes: ['residential'],
        unitCount: 'medium',
        hasEmergencyLine: true,
        maintenanceEmergencyTriggers: ['flooding', 'no_heat', 'gas_smell', 'sparking', 'security', 'fire'],
        petPolicy: 'case_by_case',
      },
      business_name: 'Bowness Property Management',
      agent_name: 'Jade',
      after_hours_behavior: 'route_emergency',
    }

    const { error: insertErr } = await svc.from('intake_submissions').insert({
      client_slug: SLUG,
      business_name: 'Bowness Property Management',
      intake_json: pmIntake,
      submitted_at: new Date().toISOString(),
    })
    if (insertErr) throw new Error(`Failed to insert synthetic intake: ${insertErr.message}`)
    console.log('Synthetic PM intake created ✓')
    intake = { intake_json: pmIntake }
  }

  const intakeData = { ...intake.intake_json } as Record<string, unknown>
  // Preserve the current agent_name
  if (client.agent_name) intakeData.db_agent_name = client.agent_name

  const newPrompt = buildPromptFromIntake(intakeData)
  console.log(`\nBuilt prompt: ${newPrompt.length} chars`)

  // Show first 500 chars for verification
  console.log('--- Preview ---')
  console.log(newPrompt.substring(0, 500))
  console.log('...')

  // Check PM niche markers are present
  const hasTriage = newPrompt.includes('P1') || newPrompt.includes('P2') || newPrompt.includes('URGENT')
  const hasPM = newPrompt.toLowerCase().includes('property') || newPrompt.toLowerCase().includes('maintenance')
  const hasTransferRule = newPrompt.includes('P1 emergency') || newPrompt.includes('burst pipe') || newPrompt.includes('flooding')
  console.log(`\nPM markers: triage=${hasTriage} | pm_content=${hasPM} | transfer_rule=${hasTransferRule}`)

  if (!hasPM) {
    console.warn('WARNING: Prompt does not appear to contain PM content. Check niche detection.')
  }

  // Save to Supabase
  const { error: dbErr } = await svc.from('clients')
    .update({ system_prompt: newPrompt, updated_at: new Date().toISOString() })
    .eq('id', client.id)
  if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`)
  console.log('\nSaved to Supabase ✓')

  // Sync to Ultravox
  if (client.ultravox_agent_id) {
    const agentFlags = {
      systemPrompt: newPrompt,
      ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
      booking_enabled: client.booking_enabled ?? false,
      slug: client.slug,
      forwarding_number: (client.forwarding_number as string | null) || undefined,
      transfer_conditions: (client.transfer_conditions as string | null) || undefined,
      sms_enabled: client.sms_enabled ?? false,
      twilio_number: (client.twilio_number as string | null) || undefined,
    }
    await updateAgent(client.ultravox_agent_id, agentFlags)

    // Keep clients.tools in sync
    const syncTools = buildAgentTools(agentFlags)
    await svc.from('clients').update({ tools: syncTools }).eq('id', client.id)

    console.log(`Synced to Ultravox agent ${client.ultravox_agent_id} ✓`)
    console.log(`Tools count: ${syncTools.length}`)
  } else {
    console.log('No Ultravox agent ID — skipping sync')
  }

  console.log('\nDone. TrueColor is now running the PM prompt on Jade.')
  console.log(`Call +1 (575) 332-5085 and say "my pipe just burst" to test P1 flow.`)
}

main().catch(e => { console.error(e); process.exit(1) })
