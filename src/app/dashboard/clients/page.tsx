import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
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

  const svc = createServiceClient()

  const { data: clients } = await svc
    .from('clients')
    .select('id, slug, business_name, twilio_number, niche, status')
    .order('business_name')

  const clientIds = (clients ?? []).map(c => c.id)

  // Get client → user mapping and last_sign_in_at from auth.users
  const lastLoginMap = new Map<string, string | null>()
  if (clientIds.length > 0) {
    const { data: cuRows } = await svc.from('client_users').select('client_id, user_id').in('client_id', clientIds).neq('role', 'admin')
    const cuMap = new Map((cuRows ?? []).map(r => [r.client_id as string, r.user_id as string]))
    const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 })
    const authMap = new Map((users ?? []).map(u => [u.id, u.last_sign_in_at ?? null]))
    for (const [clientId, userId] of cuMap) {
      lastLoginMap.set(clientId, authMap.get(userId) ?? null)
    }
  }

  // D452: latest drift snapshot per client (newest row wins).
  const driftMap = new Map<string, { chars_dropped: number | null; status: string; biggest_drop_section: string | null; checked_at: string }>()
  if (clientIds.length > 0) {
    const { data: driftRows } = await svc
      .from('client_drift_log')
      .select('client_id, chars_dropped, status, biggest_drop_section, checked_at')
      .in('client_id', clientIds)
      .order('checked_at', { ascending: false })
    for (const row of driftRows ?? []) {
      const cid = row.client_id as string
      if (driftMap.has(cid)) continue
      driftMap.set(cid, {
        chars_dropped: row.chars_dropped as number | null,
        status: row.status as string,
        biggest_drop_section: row.biggest_drop_section as string | null,
        checked_at: row.checked_at as string,
      })
    }
  }

  const clientsWithLogin = (clients ?? []).map(c => ({
    ...c,
    last_sign_in_at: lastLoginMap.get(c.id) ?? null,
    drift: driftMap.get(c.id) ?? null,
  }))

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-1)" }}>Clients</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-3)" }}>
          Active client accounts — {clientsWithLogin.length} total
        </p>
      </div>

      <ClientsTable
        clients={clientsWithLogin as Parameters<typeof ClientsTable>[0]['clients']}
      />
    </div>
  )
}
