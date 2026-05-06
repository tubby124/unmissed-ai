/**
 * Manually points clients.active_prompt_version_id at the latest
 * prompt_versions row (the one recomposePrompt just inserted but didn't link).
 *
 * Slot-regenerator.ts bug: line 332 inserts the audit row but doesn't run the
 * follow-up update on active_prompt_version_id. The auto-regen.ts path on
 * line 137 does it correctly. File a D-NEW after running this.
 */
import { config } from 'dotenv'; config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const CID = 'bff9d635-436f-44a6-a84a-5e143fff7c18'

  const { data: latest, error: lErr } = await svc
    .from('prompt_versions')
    .select('id, version, created_at')
    .eq('client_id', CID)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lErr || !latest) throw new Error(`no prompt_versions: ${lErr?.message}`)
  const l = latest as Record<string, unknown>

  const { data: pre } = await svc
    .from('clients')
    .select('active_prompt_version_id')
    .eq('id', CID)
    .single()
  console.log(`pre  active_prompt_version_id: ${(pre as Record<string, unknown>).active_prompt_version_id}`)
  console.log(`target latest version v${l.version}: id=${l.id}`)

  if ((pre as Record<string, unknown>).active_prompt_version_id === l.id) {
    console.log('already pointing at latest. nothing to do.')
    return
  }

  const { error: uErr } = await svc
    .from('clients')
    .update({ active_prompt_version_id: l.id as string })
    .eq('id', CID)
  if (uErr) throw new Error(`update failed: ${uErr.message}`)

  const { data: post } = await svc
    .from('clients')
    .select('active_prompt_version_id')
    .eq('id', CID)
    .single()
  console.log(`post active_prompt_version_id: ${(post as Record<string, unknown>).active_prompt_version_id}`)
  console.log('✅ pointer updated')
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
