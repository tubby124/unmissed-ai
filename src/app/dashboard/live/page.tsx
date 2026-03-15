import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CallRow from '@/components/dashboard/CallRow'

export const dynamic = 'force-dynamic'

export default async function LivePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!cu) redirect('/login')

  const isAdmin = cu.role === 'admin'

  let q = supabase
    .from('call_logs')
    .select('id, ultravox_call_id, caller_phone, call_status, ai_summary, service_type, duration_seconds, started_at, confidence, sentiment, key_topics, next_steps, quality_score, clients(business_name, slug)')
    .in('call_status', ['live', 'processing'])
    .order('started_at', { ascending: false })

  if (!isAdmin && cu.client_id) q = q.eq('client_id', cu.client_id)

  const { data: calls } = await q

  const liveCalls = (calls ?? []).map(c => ({
    ...c,
    business_name: (c.clients as { business_name?: string } | null)?.business_name ?? null,
  }))

  return (
    <div className="p-3 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-1)' }}>Live Calls</h1>
          {liveCalls.length > 0 && (
            <span className="text-[11px] font-mono bg-green-500/15 text-green-400 border border-green-500/25 rounded-full px-2 py-0.5">
              {liveCalls.length} active
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Calls in progress and currently being processed</p>
      </div>

      {liveCalls.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20" style={{ color: 'var(--color-text-3)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-25">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6.3 6.3a8 8 0 1011.4 11.4M6.3 6.3A8 8 0 0117.7 17.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-2)' }}>No active calls</p>
            <p className="text-xs">Calls in progress will appear here in real time</p>
          </div>
          <Link href="/dashboard/calls" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
            View all calls →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {liveCalls.map(call => (
            <CallRow
              key={call.id}
              call={call}
              showBusiness={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
