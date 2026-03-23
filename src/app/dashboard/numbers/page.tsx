import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import NumbersView from './NumbersView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Number Inventory' }

export default async function NumbersPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  return <NumbersView />
}
