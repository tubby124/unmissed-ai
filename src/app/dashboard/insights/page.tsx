import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import InsightsView from '@/components/dashboard/InsightsView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Insights' }

interface ClientInfo {
  id: string
  slug: string
  business_name: string
}

export default async function InsightsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let clientId: string | null = null
  let isAdmin = false
  let adminClients: ClientInfo[] = []

  if (user) {
    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id, role, clients(business_name, status)')
      .eq('user_id', user.id)
      .single()

    if (cu?.role === 'admin') {
      isAdmin = true
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, slug, business_name')
        .in('status', ['active', 'paused'])
        .order('business_name')
      adminClients = (allClients ?? []) as ClientInfo[]
    } else {
      clientId = cu?.client_id ?? null
      const clientData = cu?.clients as { status?: string } | null
      if (clientData?.status === 'setup') {
        redirect('/dashboard/setup')
      }
    }
  }

  return (
    <div className="p-3 sm:p-6">
      <InsightsView
        clientId={clientId}
        isAdmin={isAdmin}
        adminClients={adminClients}
      />
    </div>
  )
}
