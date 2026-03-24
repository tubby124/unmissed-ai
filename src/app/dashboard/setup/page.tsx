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
  subscription_status: string | null
  setup_complete: boolean | null
  business_hours_weekday: string | null
  business_hours_weekend: string | null
  after_hours_behavior: string | null
  after_hours_emergency_phone: string | null
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const isNewUpgrade = params.upgraded === 'true'

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

  const SELECT = 'id, slug, business_name, niche, twilio_number, status, subscription_status, setup_complete, business_hours_weekday, business_hours_weekend, after_hours_behavior, after_hours_emergency_phone'

  if (isAdmin) {
    const { data: clients } = await supabase
      .from('clients')
      .select(SELECT)
      .order('business_name')

    return (
      <SetupView
        clients={(clients ?? []) as SetupClientConfig[]}
        isAdmin={true}
        isNewUpgrade={isNewUpgrade}
      />
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select(SELECT)
    .eq('id', cu.client_id)
    .single()

  if (!client) redirect('/login')

  const isTrialing = (client as Record<string, unknown>).subscription_status === 'trialing'

  return (
    <SetupView
      clients={[client as SetupClientConfig]}
      isAdmin={false}
      isTrialing={isTrialing}
      isNewUpgrade={isNewUpgrade}
    />
  )
}
