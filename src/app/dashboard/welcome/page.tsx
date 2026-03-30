import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import WelcomeWizard from './WelcomeWizard'
import ProvisioningWait from './ProvisioningWait'

export const dynamic = 'force-dynamic'

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const isNewActivation = params.new === '1'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || cu.role === 'admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('twilio_number, subscription_status, selected_plan, business_name, agent_name')
    .eq('id', cu.client_id)
    .single()

  // Still provisioning — webhook hasn't fired yet. Show a wait screen that
  // auto-reloads until the Twilio number appears.
  if (isNewActivation && client && !client.twilio_number) {
    return <ProvisioningWait />
  }

  // Ready: show the wizard
  if (client && client.subscription_status === 'active' && client.twilio_number) {
    return (
      <WelcomeWizard
        twilioNumber={client.twilio_number}
        agentName={client.agent_name ?? client.business_name ?? 'your agent'}
        selectedPlan={client.selected_plan ?? 'core'}
      />
    )
  }

  redirect('/dashboard')
}
