import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import DemoStats from '@/components/dashboard/DemoStats'

export const dynamic = 'force-dynamic'

export default async function DemosPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold t1">Demos</h1>
        <p className="text-xs t3 mt-0.5">Website demo call analytics and conversion metrics</p>
      </div>
      <DemoStats />
    </div>
  )
}
