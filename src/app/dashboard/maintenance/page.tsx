import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import MaintenanceTab from '@/components/dashboard/MaintenanceTab'

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role, clients(niche)')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) redirect('/dashboard')

  const isAdmin = cu.role === 'admin'
  const clientData = cu.clients as { niche?: string | null } | null
  const niche = isAdmin ? null : (clientData?.niche ?? null)

  // Gate: only property_management clients and admins can view this page
  if (!isAdmin && niche !== 'property_management') {
    redirect('/dashboard')
  }

  return <MaintenanceTab />
}
