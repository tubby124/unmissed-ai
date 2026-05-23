import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SystemPulse from '@/components/dashboard/SystemPulse'
import ActionItems from '@/components/dashboard/ActionItems'
import LiveCallBanner from '@/components/dashboard/LiveCallBanner'
import ClientHealthBar from '@/components/dashboard/ClientHealthBar'
import ClientHomeV2 from '@/components/dashboard/ClientHomeV2'
import MonthlySpendCard from '@/components/dashboard/MonthlySpendCard'
import TalkToZaraAdminButton from '@/components/dashboard/TalkToZaraAdminButton'
import PageHeader from '@/components/dashboard/PageHeader'
import SectionLabel from '@/components/dashboard/SectionLabel'
import { isAdminRedesignEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  const isAdmin = cu?.role === 'admin'

  if (!isAdmin) {
    return <ClientHomeV2 />
  }

  // Admin in legacy preview mode (still supported until Phase 7 cleanup): show client's dashboard.
  const isPreview = params.preview === 'true' && typeof params.client_id === 'string'
  if (isPreview) return <ClientHomeV2 />

  // Phase 2 — when redesign is on, admins land on their *client's* Overview view
  // scoped via the switcher (URL ?client_id=). Command Center moved to /dashboard/admin.
  if (isAdminRedesignEnabled()) {
    const scopedClientId = typeof params.client_id === 'string' ? params.client_id : null
    if (scopedClientId) {
      // Re-uses the existing client home component; ClientHomeV2 already reads
      // ?client_id= and routes /api/dashboard/home through that scope.
      return <ClientHomeV2 />
    }
    return (
      <div className="p-3 sm:p-6 space-y-6">
        <PageHeader title="Pick a client" subtitle="Use the switcher above to inspect a client's Overview, or open the Command Center." />
        <div className="rounded-xl border p-6 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}>
          <p className="mb-3">No client scope is selected.</p>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'var(--color-cta)', color: 'white' }}
          >
            Open Admin Command Center →
          </Link>
        </div>
      </div>
    )
  }

  // Flag OFF — legacy admin Command Center remains exactly as before.
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes')
    .eq('status', 'active')
    .order('business_name')

  const adminClients = (allClients ?? []).map(c => ({
    id: c.id,
    slug: c.slug,
    business_name: c.business_name,
    niche: (c as Record<string, unknown>).niche as string | null ?? null,
    status: (c as Record<string, unknown>).status as string | null ?? null,
    twilio_number: (c as Record<string, unknown>).twilio_number as string | null ?? null,
    seconds_used_this_month: c.seconds_used_this_month as number | null ?? null,
    monthly_minute_limit: c.monthly_minute_limit as number | null ?? null,
    bonus_minutes: c.bonus_minutes as number | null ?? null,
  }))

  const { data: liveCalls } = await supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, started_at, transfer_status, clients(business_name)')
    .eq('call_status', 'live')
    .order('started_at', { ascending: false })

  const liveCallsForBanner = (liveCalls ?? []).map(c => ({
    id: c.id,
    ultravox_call_id: c.ultravox_call_id,
    caller_phone: c.caller_phone,
    started_at: c.started_at,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
    transfer_status: c.transfer_status,
  }))

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: hotLeads } = await supabase
    .from('call_logs')
    .select('client_id, started_at')
    .eq('call_status', 'HOT')
    .gte('started_at', monthStart)

  // MTD spend — uses billed_cost_cents populated by the Ultravox webhook (see src/lib/pricing-rates.ts).
  // Limit 5000 covers ~10 active clients at peak.
  const { data: spendRows } = await supabase
    .from('call_logs')
    .select('client_id, billed_cost_cents, billed_duration_seconds, clients(business_name, slug)')
    .gte('started_at', monthStart)
    .gt('billed_cost_cents', 0)
    .limit(5000)

  const spendByClient = new Map<string, { name: string; slug: string; cents: number; seconds: number; calls: number }>()
  let totalCents = 0
  let totalSeconds = 0
  let totalCalls = 0
  for (const r of spendRows ?? []) {
    const cents = (r.billed_cost_cents as number | null) ?? 0
    const secs = (r.billed_duration_seconds as number | null) ?? 0
    totalCents += cents
    totalSeconds += secs
    totalCalls += 1
    const cid = (r.client_id as string | null) ?? ''
    if (!cid) continue
    const cdata = r.clients as { business_name?: string; slug?: string } | null
    const existing = spendByClient.get(cid) ?? {
      name: cdata?.business_name ?? '(unknown)',
      slug: cdata?.slug ?? '',
      cents: 0,
      seconds: 0,
      calls: 0,
    }
    existing.cents += cents
    existing.seconds += secs
    existing.calls += 1
    spendByClient.set(cid, existing)
  }
  const topSpenders = Array.from(spendByClient.values())
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5)

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <PageHeader title="Command Center" subtitle="What needs attention right now" />

      {/* System health */}
      <SystemPulse />

      {/* MTD platform spend — top earners + deep-link to /dashboard/costs */}
      <MonthlySpendCard
        totalCents={totalCents}
        totalSeconds={totalSeconds}
        totalCalls={totalCalls}
        topClients={topSpenders}
        rangeLabel="This Month"
      />

      {/* Zara admin mode — voice-driven god access */}
      <TalkToZaraAdminButton />

      {/* Action items — the core of this page */}
      <div>
        <SectionLabel className="mb-2">Action Items</SectionLabel>
        <ActionItems />
      </div>

      {/* Live calls */}
      <LiveCallBanner calls={liveCallsForBanner} />

      {/* Client health */}
      <ClientHealthBar
        adminClients={adminClients}
        hotLeads={(hotLeads ?? []).map(h => ({ client_id: h.client_id, started_at: h.started_at }))}
      />
    </div>
  )
}
