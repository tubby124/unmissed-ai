import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import ClientsTable from '@/components/dashboard/ClientsTable'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  const { data: intakes } = await supabase
    .from('intake_submissions')
    .select('id, submitted_at, status, progress_status, business_name, niche, client_id, intake_json')
    .order('submitted_at', { ascending: false })

  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, business_name, twilio_number')
    .order('business_name')

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Onboarding submissions and active client accounts
        </p>
      </div>

      <ClientsTable
        intakes={(intakes ?? []) as Parameters<typeof ClientsTable>[0]['intakes']}
        clients={(clients ?? []) as Parameters<typeof ClientsTable>[0]['clients']}
      />
    </div>
  )
}
