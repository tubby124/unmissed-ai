import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import LabView from './LabView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agent Lab' }

interface PromptVersion {
  id: string
  version: number
  content: string
  change_description: string | null
  created_at: string
  is_active: boolean
}

export default async function LabPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role, clients(system_prompt, agent_name, niche, twilio_number, slug)')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/dashboard')

  const isAdmin = cu.role === 'admin'
  const params = await searchParams
  const queryClientId = isAdmin ? (params.client_id ?? null) : null

  const clientId: string | null = isAdmin ? queryClientId : (cu.client_id as string | null)
  let systemPrompt: string | null = null
  let agentName = 'Agent'
  let niche: string | null = null

  if (isAdmin && queryClientId) {
    // Admin selected a specific client via ?client_id=
    const { data: targetClient } = await supabase
      .from('clients')
      .select('id, system_prompt, agent_name, niche')
      .eq('id', queryClientId)
      .single()
    if (targetClient) {
      systemPrompt = targetClient.system_prompt ?? null
      agentName = targetClient.agent_name ?? 'Agent'
      niche = targetClient.niche ?? null
    }
  } else if (!isAdmin) {
    const clientData = cu.clients as { system_prompt?: string | null; agent_name?: string | null; niche?: string | null } | null
    systemPrompt = clientData?.system_prompt ?? null
    agentName = clientData?.agent_name ?? 'Agent'
    niche = clientData?.niche ?? null
  }

  // Fetch last 10 prompt versions
  let versions: PromptVersion[] = []
  if (clientId) {
    const { data } = await supabase
      .from('prompt_versions')
      .select('id, version, content, change_description, created_at, is_active')
      .eq('client_id', clientId)
      .order('version', { ascending: false })
      .limit(10)
    versions = (data ?? []) as PromptVersion[]
  }

  return (
    <div className="p-3 sm:p-6">
      <LabView
        isAdmin={isAdmin}
        clientId={clientId}
        livePrompt={systemPrompt}
        agentName={agentName}
        niche={niche}
        initialVersions={versions}
      />
    </div>
  )
}
