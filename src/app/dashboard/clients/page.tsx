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
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') redirect('/dashboard/calls')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, business_name, twilio_number, niche, status')
    .order('business_name')

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-1)" }}>Clients</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>
          Active client accounts — {(clients ?? []).length} total
        </p>
      </div>

      <ClientsTable
        clients={(clients ?? []) as Parameters<typeof ClientsTable>[0]['clients']}
      />
    </div>
  )
}
