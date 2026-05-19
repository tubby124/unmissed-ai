import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CLIENT_CONFIG_SELECT } from '@/lib/clients/select-columns'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import GoLiveView from './GoLiveView'
import { BRAND_NAME } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Go Live · ${BRAND_NAME}`,
  description: 'Set up your agent and take your first real call.',
}

export default async function GoLivePage({
  searchParams,
}: {
  searchParams?: Promise<{ client_id?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Mirror src/app/dashboard/settings/page.tsx — never use .single() on client_users
  // (admins have multiple rows). Always order by role + limit(1).maybeSingle().
  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) redirect('/dashboard')

  const isAdmin = cu.role === 'admin'
  // Admin can pick a client via ?client_id; otherwise fall back to first available row.
  const targetClientId =
    isAdmin && params.client_id
      ? params.client_id
      : cu.client_id

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select(CLIENT_CONFIG_SELECT)
    .eq('id', targetClientId)
    .maybeSingle()

  // Don't kick to /login on data errors — user is authenticated. Surface the issue.
  if (clientErr || !client) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">Couldn&apos;t load Go Live</h1>
        <p className="text-sm text-zinc-600 mb-4">
          {clientErr?.message ?? 'No client record found for this account.'}
        </p>
        <p className="text-xs text-zinc-500">
          If this just appeared after a deploy, the <code>forwarding_verified_at</code> and{' '}
          <code>forwarding_self_attested</code> columns may need to be applied to the database
          (see <code>supabase/migrations/20260426000000_add_forwarding_verified_columns.sql</code>).
        </p>
      </div>
    )
  }

  // Go Live proof should come from a completed real phone-path call, not a
  // browser/direct test call or a merely connected Twilio leg.
  const { data: proofCalls } = await supabase
    .from('call_logs')
    .select('id')
    .eq('client_id', targetClientId)
    .in('call_status', ['HOT', 'WARM', 'COLD'])
    .not('twilio_call_sid', 'is', null)
    .not('ultravox_call_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5)

  const proofCallIds = (proofCalls ?? []).map((row) => row.id as string)
  let hasTestCall = proofCallIds.length > 0
  const requiresEmailProof = client.email_notifications_enabled !== false && !!client.contact_email
  if (requiresEmailProof && proofCallIds.length > 0) {
    const { count: sentEmailCount } = await supabase
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .in('call_id', proofCallIds)
      .eq('channel', 'email')
      .eq('status', 'sent')
      .limit(1)
    hasTestCall = (sentEmailCount ?? 0) > 0
  }

  return (
    <GoLiveView
      client={client as ClientConfig}
      hasTestCall={hasTestCall}
      isAdmin={isAdmin}
    />
  )
}
