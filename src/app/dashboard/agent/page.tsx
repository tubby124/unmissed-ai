import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { CLIENT_CONFIG_SELECT } from '@/lib/clients/select-columns'
import AgentPageView from './AgentPageView'

// Phase E.5 Wave 4 — unhide /dashboard/agent.
// Pre-E.5 this redirected to /dashboard?tab=overview&section=identity, making
// AgentPageView (and the Phase E Wave 3 Day-1 edit panel inside it) orphan
// code. Sidebar/MobileNav/settings link here → now they resolve to a real view.

export const dynamic = 'force-dynamic'

export default async function AgentPage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string; preview?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const initialClientId = params?.client_id
  const previewMode = params?.preview === 'true'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(CLIENT_CONFIG_SELECT)
      .order('business_name')

    return (
      <AgentPageView
        clients={(clients ?? []) as ClientConfig[]}
        isAdmin={true}
        previewMode={previewMode}
        initialClientId={initialClientId}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(CLIENT_CONFIG_SELECT)
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/login')

  return (
    <AgentPageView
      clients={[client as ClientConfig]}
      isAdmin={false}
      previewMode={previewMode}
      initialClientId={initialClientId}
    />
  )
}
