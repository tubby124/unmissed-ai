/**
 * /dashboard/admin/integrations
 *
 * Admin-only Integrations panel — one row per active client showing which
 * external system each integration is wired into, plus connection status.
 *
 * Phase 1A: Booking provider only (Google / Gettimely). Phase 1B+ will add:
 *   - Twilio numbers
 *   - Stripe customer/subscription
 *   - Telegram bot bind
 *   - Knowledge sources (website, GBP, PDFs)
 *
 * This is a pure read-only audit view. To connect/disconnect a provider for a
 * specific client, jump into that client's settings (link in the row).
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Integrations' }

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google Calendar',
  gettimely: 'Gettimely',
}

function StatusPill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    red: 'bg-red-500/10 text-red-300 border-red-500/20',
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  }[tone]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {children}
    </span>
  )
}

interface IntegrationRow {
  id: string
  slug: string
  business_name: string
  niche: string | null
  status: string | null
  booking_provider: string | null
  calendar_auth_status: string | null
  google_refresh_token: string | null
  gettimely_refresh_token: string | null
  gettimely_staff_id: string | null
}

export default async function AdminIntegrationsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    redirect('/dashboard')
  }

  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('clients')
    .select('id, slug, business_name, niche, status, booking_provider, calendar_auth_status, google_refresh_token, gettimely_refresh_token, gettimely_staff_id')
    .order('business_name')

  const clients: IntegrationRow[] = (rows ?? []) as IntegrationRow[]

  const totalActive = clients.filter(c => c.status === 'active').length
  const googleConnected = clients.filter(c => c.booking_provider === 'google' && c.google_refresh_token).length
  const gettimelyConnected = clients.filter(c => c.booking_provider === 'gettimely' && c.gettimely_refresh_token && c.gettimely_staff_id).length

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold t1">Integrations</h1>
        <p className="text-sm t3 mt-1">External systems connected per client. Read-only audit view.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl border b-theme bg-surface p-4">
          <p className="text-[10px] tracking-wider uppercase t3 mb-1">Active clients</p>
          <p className="text-xl font-semibold t1">{totalActive}</p>
        </div>
        <div className="rounded-2xl border b-theme bg-surface p-4">
          <p className="text-[10px] tracking-wider uppercase t3 mb-1">Google Calendar</p>
          <p className="text-xl font-semibold t1">{googleConnected}</p>
        </div>
        <div className="rounded-2xl border b-theme bg-surface p-4">
          <p className="text-[10px] tracking-wider uppercase t3 mb-1">Gettimely</p>
          <p className="text-xl font-semibold t1">{gettimelyConnected}</p>
          <p className="text-[10px] t3 mt-0.5">Phase 1B</p>
        </div>
        <div className="rounded-2xl border b-theme bg-surface p-4">
          <p className="text-[10px] tracking-wider uppercase t3 mb-1">No booking</p>
          <p className="text-xl font-semibold t1">{Math.max(0, totalActive - googleConnected - gettimelyConnected)}</p>
        </div>
      </div>

      {/* Booking section */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-sm font-semibold t1 uppercase tracking-wider">Booking</h2>
          <p className="text-[11px] t3">Calendar/booking system the agent uses for live appointments.</p>
        </div>
        <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-hover">
              <tr className="text-left t3 text-[10px] uppercase tracking-wider">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Niche</th>
                <th className="px-4 py-2.5">Provider</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Auth</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center t3">No clients yet.</td>
                </tr>
              )}
              {clients.map(c => {
                const providerId = c.booking_provider ?? 'google'
                const providerLabel = PROVIDER_LABEL[providerId] ?? providerId
                const isConnected = providerId === 'google'
                  ? Boolean(c.google_refresh_token)
                  : providerId === 'gettimely'
                    ? Boolean(c.gettimely_refresh_token && c.gettimely_staff_id)
                    : false

                const statusTone = c.status === 'active' ? 'green' : c.status === 'trialing' ? 'amber' : 'slate'
                const authTone: 'green' | 'amber' | 'red' | 'slate' = isConnected
                  ? 'green'
                  : c.calendar_auth_status === 'expired'
                    ? 'red'
                    : 'slate'
                const authLabel = isConnected
                  ? 'Connected'
                  : c.calendar_auth_status === 'expired'
                    ? 'Expired'
                    : 'Not connected'

                return (
                  <tr key={c.id} className="border-t b-theme">
                    <td className="px-4 py-3">
                      <div className="font-medium t1">{c.business_name}</div>
                      <div className="text-[10px] font-mono t3">{c.slug}</div>
                    </td>
                    <td className="px-4 py-3 t2">{c.niche ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone="slate">{providerLabel}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={statusTone}>{c.status ?? 'unknown'}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={authTone}>{authLabel}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/settings?client_id=${c.id}#section-booking`}
                        className="text-[11px] font-medium text-[var(--color-primary)] hover:opacity-75 transition"
                      >
                        Configure →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">Coming in Phase 1B</h3>
        <ul className="text-[11px] t3 space-y-1 list-disc list-inside">
          <li>Gettimely OAuth (live) — barbershops/salons book directly into staff calendars</li>
          <li>Twilio number routing (per-client carrier + forwarding state)</li>
          <li>Stripe subscription health (status + grace period + minute usage)</li>
          <li>Telegram bot bind (per-client deep-link state)</li>
          <li>Knowledge sources (website + GBP + PDF document inventory)</li>
        </ul>
      </section>
    </main>
  )
}
