/**
 * /dashboard/admin/clients — admin Mission Control client roster.
 *
 * MRR / active / trial / stale header stats + full client roster with billing
 * state, call activity, minute usage, and pause/resume actions.
 *
 * Admin-only. Server component does the auth gate; data comes from
 * GET /api/admin/clients-roster (same route the pause/resume PATCH hits).
 * Mirrors the pattern of /dashboard/admin/notifications.
 */

import { redirect } from 'next/navigation'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import ClientRosterView from '@/components/admin/roster/ClientRosterView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Client Roster' }

export default async function AdminClientRosterPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Client Roster" subtitle="Every client — billing state, call activity, and health at a glance" />
      <ClientRosterView />
    </div>
  )
}
