'use client'

/**
 * LifecycleDrawer — slide-in panel showing one client's full lifecycle.
 *
 * Calls the public.client_lifecycle(p_slug) RPC (server-routed via /api/admin/hermes/lifecycle-proxy
 * to avoid exposing the anon key in browser). Shows subscription state, renewal
 * date, plan, contact email, and the most recent notifications joined inline.
 */

import { useEffect, useState } from 'react'

interface LifecycleData {
  slug: string
  business_name: string
  status: string | null
  subscription_status: string | null
  trial_converted: boolean | null
  selected_plan: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_expires_at: string | null
  subscription_current_period_end: string | null
  contact_email: string | null
  monthly_minute_limit: number | null
  minutes_used_this_month: number | null
  recent_notifications: Array<{
    created_at: string
    channel: string
    status: string
    content: string
    error: string | null
  }> | null
}

function statusColor(s: string | null): { bg: string; fg: string } {
  switch (s) {
    case 'active':    return { bg: 'rgba(34,197,94,0.12)',  fg: 'rgb(34,197,94)'   }
    case 'trialing':  return { bg: 'rgba(99,102,241,0.12)', fg: 'rgb(129,140,248)' }
    case 'past_due':
    case 'canceled':
    case 'expired':   return { bg: 'rgba(239,68,68,0.12)',  fg: 'rgb(239,68,68)'   }
    default:          return { bg: 'rgba(148,163,184,0.12)', fg: 'rgb(148,163,184)' }
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function fmtRelative(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const diffMs = Date.now() - d
    const m = Math.floor(diffMs / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return iso }
}

export default function LifecycleDrawer({
  slug,
  onClose,
}: {
  slug: string
  onClose: () => void
}) {
  const [data, setData]   = useState<LifecycleData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    fetch(`/api/admin/notifications/lifecycle?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((j) => {
        if (cancel) return
        setData(j.data ?? null)
        setLoading(false)
      })
      .catch((e) => {
        if (cancel) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => { cancel = true }
  }, [slug])

  const sc = statusColor(data?.subscription_status ?? null)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />

      {/* panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
        }}
      >
        <div
          className="sticky top-0 px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <div className="text-[16px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
              {data?.business_name ?? slug}
            </div>
            <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-3)' }}>{slug}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-[12px]"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              Loading lifecycle…
            </div>
          )}

          {error && (
            <div
              className="rounded p-3 text-[12px]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                color: 'rgb(248,113,113)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              Error: {error}
            </div>
          )}

          {data && (
            <>
              {/* Subscription status */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>Subscription</div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded font-medium uppercase tracking-wider"
                    style={{ backgroundColor: sc.bg, color: sc.fg }}
                  >
                    {data.subscription_status ?? 'unknown'}
                  </span>
                  {data.trial_converted && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                      style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}
                    >
                      paid
                    </span>
                  )}
                  {data.selected_plan && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                      style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
                    >
                      {data.selected_plan}
                    </span>
                  )}
                </div>
              </div>

              {/* Key dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Next renewal</div>
                  <div className="text-[13px]" style={{ color: 'var(--color-text-1)' }}>
                    {fmtDate(data.subscription_current_period_end)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Trial ends</div>
                  <div className="text-[13px]" style={{ color: 'var(--color-text-1)' }}>
                    {fmtDate(data.trial_expires_at)}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Contact email</div>
                <div className="text-[12px] font-mono break-all" style={{ color: 'var(--color-text-1)' }}>
                  {data.contact_email ?? '—'}
                </div>
              </div>

              {/* Stripe */}
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Stripe customer</div>
                  <div className="text-[11px] font-mono break-all" style={{ color: 'var(--color-text-2)' }}>
                    {data.stripe_customer_id ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Stripe subscription</div>
                  <div className="text-[11px] font-mono break-all" style={{ color: 'var(--color-text-2)' }}>
                    {data.stripe_subscription_id ?? '—'}
                  </div>
                </div>
              </div>

              {/* Minutes */}
              {data.monthly_minute_limit !== null && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-3)' }}>Minutes this period</div>
                  <div className="text-[13px]" style={{ color: 'var(--color-text-1)' }}>
                    {data.minutes_used_this_month ?? 0} of {data.monthly_minute_limit}
                  </div>
                </div>
              )}

              {/* Recent notifications */}
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-3)' }}>
                  Last {data.recent_notifications?.length ?? 0} notifications
                </div>
                {(!data.recent_notifications || data.recent_notifications.length === 0) ? (
                  <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                    None.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.recent_notifications.map((n, i) => (
                      <div
                        key={i}
                        className="rounded p-2 text-[11px]"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div className="flex gap-2 items-center text-[10px] mb-1" style={{ color: 'var(--color-text-3)' }}>
                          <span>{fmtRelative(n.created_at)}</span>
                          <span>·</span>
                          <span className="uppercase tracking-wider">{n.channel}</span>
                          <span>·</span>
                          <span
                            className="uppercase tracking-wider font-medium"
                            style={{
                              color: n.status === 'failed' || n.status === 'bounced' || n.status === 'complained' ? 'rgb(248,113,113)'
                                   : n.status === 'delivered' || n.status === 'opened' || n.status === 'clicked' ? 'rgb(74,222,128)'
                                   : 'var(--color-text-3)',
                            }}
                          >
                            {n.status}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-1)' }}>
                          {(n.content ?? '').slice(0, 240)}
                          {(n.content ?? '').length > 240 && '…'}
                        </div>
                        {n.error && (
                          <div className="mt-1 text-[10px]" style={{ color: 'rgb(248,113,113)' }}>
                            error: {n.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
