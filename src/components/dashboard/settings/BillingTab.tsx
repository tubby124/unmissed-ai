'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { fmtDate } from './shared'
import { RELOAD_OPTIONS } from './constants'
import { getPlanName } from '@/lib/settings-utils'
import { BASE_PLAN, SETUP, MINUTE_RELOAD, getEffectiveMonthly, PLANS } from '@/lib/pricing'
import UsageSummary from '@/components/dashboard/UsageSummary'
import AdminPromoPanel from './AdminPromoPanel'

interface BillingTabProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  minutesUsed: number
  minuteLimit: number
  totalAvailable: number
  usagePct: number
}

function ManageSubscriptionButton({ isAdmin, clientId, previewMode }: { isAdmin: boolean; clientId: string; previewMode?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    try {
      const body: Record<string, unknown> = {}
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      disabled={loading || previewMode}
      onClick={openPortal}
      className="mt-4 text-[11px] font-semibold px-3 py-1.5 rounded-lg b-theme hover:bg-hover t2 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {loading ? 'Redirecting...' : 'Manage Subscription'}
    </button>
  )
}

// ── Trial upgrade section ─────────────────────────────────────────────────────
function TrialUpgradeSection({ clientId, previewMode }: { clientId: string; previewMode?: boolean }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function startUpgrade(planId: string) {
    if (previewMode) return
    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billing, clientId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoadingPlan(null)
    } catch {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">You&apos;re on a free trial</p>
        <p className="text-sm t2">Pick a plan to go live and start receiving real calls on your business number.</p>
      </div>

      {/* Monthly / Annual toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBilling('monthly')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${billing === 'monthly' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'b-theme t3 hover:bg-hover'}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${billing === 'annual' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'b-theme t3 hover:bg-hover'}`}
        >
          Annual
          <span className="ml-1.5 text-[10px] text-green-400">Save 20%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {PLANS.map(plan => {
          const price = billing === 'annual' ? plan.annual : plan.monthly
          const isLoading = loadingPlan === plan.id
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border b-theme bg-surface p-5 ${plan.isPopular ? 'border-blue-500/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold t1">{plan.name}</span>
                    {plan.isPopular && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-blue-400 border-blue-500/30 bg-blue-500/10">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] t3 mb-3">{plan.tagline}</p>
                  <ul className="space-y-1">
                    {plan.features.slice(0, 4).map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px] t2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-green-400">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-xl font-bold t1">${price}</span>
                    <span className="text-[11px] t3">/mo CAD</span>
                    {billing === 'annual' && (
                      <p className="text-[10px] text-green-400 mt-0.5">Billed ${plan.annualBilledTotal}/yr</p>
                    )}
                  </div>
                  <button
                    disabled={!!loadingPlan || previewMode}
                    onClick={() => startUpgrade(plan.id)}
                    className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer ${
                      plan.isPopular
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'b-theme hover:bg-hover t1'
                    }`}
                  >
                    {isLoading ? 'Redirecting...' : `Get ${plan.name}`}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BillingTab({
  client,
  isAdmin,
  previewMode,
  minutesUsed,
  minuteLimit,
  totalAvailable,
  usagePct,
}: BillingTabProps) {
  const [reloadMinutes, setReloadMinutes] = useState(RELOAD_OPTIONS[0].minutes)
  const [reloadLoading, setReloadLoading] = useState(false)

  const isTrial = client.subscription_status === 'trialing'

  // Trial users see the plan picker — none of the paid billing UI is relevant yet
  if (isTrial && !isAdmin) {
    return <TrialUpgradeSection clientId={client.id} previewMode={previewMode} />
  }

  const now = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const planName = getPlanName(client.monthly_minute_limit, client.selected_plan)
  const effectiveRate = client.effective_monthly_rate ?? getEffectiveMonthly()
  const hasDiscount = !!client.stripe_discount_name

  return (<>
    {!isAdmin && (
      <p className="text-[11px] t3 mb-3">Track minutes and manage plan usage.</p>
    )}
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">
      {/* Past-due warning banner */}
      {client.subscription_status === 'past_due' && (
        <div className="border-b border-red-500/30 bg-red-500/[0.06] p-4">
          <p className="text-xs font-medium text-red-400">
            Payment failed — your agent will pause on {fmtDate(client.grace_period_end)}.
            Please update your payment method.
          </p>
        </div>
      )}

      {/* Section A: Your Plan */}
      <div className="p-5 border-b b-theme">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Your Plan</p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold t1">{planName}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
            {minuteLimit} min/mo
          </span>
          {hasDiscount && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-green-400 border-green-500/30 bg-green-500/10">
              {client.stripe_discount_name}
            </span>
          )}
          {(client.bonus_minutes ?? 0) > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
              + {client.bonus_minutes} bonus
            </span>
          )}
        </div>
        <p className="text-[11px] t3 mt-2">
          {client.subscription_status === 'trialing'
            ? `Free trial — $${effectiveRate}/mo starts on ${fmtDate(client.subscription_current_period_end)}`
            : client.subscription_status === 'active'
              ? `Active — $${effectiveRate}/mo${hasDiscount ? ` (${client.stripe_discount_name})` : ''}. Renews ${fmtDate(client.subscription_current_period_end)}`
              : client.subscription_status === 'past_due'
                ? `Payment failed — update your payment method or your agent will pause on ${fmtDate(client.grace_period_end)}`
                : client.subscription_status === 'canceled'
                  ? 'No active subscription'
                  : `${minuteLimit} minutes included per month. Reload anytime below.`}
        </p>
      </div>

      {/* Section B: Usage This Cycle */}
      <div className="p-5 border-b b-theme">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Usage This Cycle</p>
          <span className="text-xs font-mono t2 tabular-nums">
            {minutesUsed} / {totalAvailable} min
          </span>
        </div>
        <div className="h-1.5 bg-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct > 100 ? 'bg-pink-500' : usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(usagePct, 100)}%` }}
          />
        </div>
        {usagePct > 100 ? (
            <p className="text-[11px] mt-2 text-amber-400">
              You&apos;ve used all {totalAvailable} free minutes. Buy more below to keep your agent running.
            </p>
        ) : (
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] t3">{fmtDate(cycleStart.toISOString())} &rarr; {fmtDate(cycleEnd.toISOString())}</p>
            <p className="text-[11px] t3 tabular-nums font-mono">
              {totalAvailable - minutesUsed} min remaining
            </p>
          </div>
        )}
      </div>

      {/* Section C: Buy Minutes */}
      <div className="p-5 border-b b-theme">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Buy Minutes</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {RELOAD_OPTIONS.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => setReloadMinutes(opt.minutes)}
              className={`rounded-lg border p-3 text-center transition-all cursor-pointer ${
                reloadMinutes === opt.minutes
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'b-theme hover:bg-hover'
              }`}
            >
              <p className="text-sm font-semibold t1">{opt.minutes} min</p>
              <p className="text-xs t3 mt-0.5">${opt.price} CAD</p>
            </button>
          ))}
        </div>
        <button
          disabled={reloadLoading || previewMode}
          onClick={async () => {
            setReloadLoading(true)
            try {
              const body: Record<string, unknown> = { minutes: reloadMinutes }
              if (isAdmin) body.client_id = client.id
              const res = await fetch('/api/stripe/create-reload-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
              const data = await res.json()
              if (data.url) {
                window.location.href = data.url
              } else {
                setReloadLoading(false)
              }
            } catch {
              setReloadLoading(false)
            }
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          {reloadLoading ? 'Redirecting...' : `Reload ${reloadMinutes} min — $${RELOAD_OPTIONS.find(o => o.minutes === reloadMinutes)?.price ?? reloadMinutes * MINUTE_RELOAD.perMinuteRate}`}
        </button>
      </div>

      {/* Section D: Account */}
      <div className="p-5 border-b b-theme">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Account</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs t3">Joined</span>
            <span className="text-xs t2 font-mono">{fmtDate(client.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs t3">Current cycle</span>
            <span className="text-xs t2 font-mono">{fmtDate(cycleStart.toISOString())} &ndash; {fmtDate(cycleEnd.toISOString())}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs t3">Next renewal</span>
            <span className="text-xs t2 font-mono">{fmtDate(client.subscription_current_period_end ?? cycleEnd.toISOString())}</span>
          </div>
          {client.stripe_customer_id && (
            <div className="flex items-center justify-between">
              <span className="text-xs t3">Setup fee</span>
              <span className="text-xs t2 font-mono">${SETUP.price} (paid)</span>
            </div>
          )}
        </div>
        <ManageSubscriptionButton isAdmin={isAdmin} clientId={client.id} previewMode={previewMode} />
      </div>

      {/* Admin: Promo Management */}
      {isAdmin && client.stripe_subscription_id && (
        <AdminPromoPanel clientId={client.id} client={client} />
      )}

      {/* Admin: Ultravox account-level usage */}
      {isAdmin && <UsageSummary isAdmin={isAdmin} />}
    </div>
  </>)
}
