import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SetupView from './SetupView'

export const dynamic = 'force-dynamic'

export interface SetupClientConfig {
  id: string
  slug: string
  business_name: string
  niche: string | null
  twilio_number: string | null
  status: string | null
  setup_complete: boolean | null
}

export default async function SetupPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'

  const SELECT = 'id, slug, business_name, niche, twilio_number, status, setup_complete'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(SELECT)
      .order('business_name')

    return (
      <SetupView
        clients={(clients ?? []) as SetupClientConfig[]}
        isAdmin={true}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(SELECT)
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/login')

  return (
    <SetupView
      clients={[client as SetupClientConfig]}
      isAdmin={false}
    />
  )
}
