import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import ClientHomeV2 from '@/components/dashboard/ClientHomeV2'

export const dynamic = 'force-dynamic'

export default async function DashboardV2Page() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ClientHomeV2 />
}
