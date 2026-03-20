'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { fmtDate } from './shared'
import { RELOAD_OPTIONS } from './constants'
import { getPlanName } from '@/lib/settings-utils'
import { BASE_PLAN, SETUP, MINUTE_RELOAD, getEffectiveMonthly } from '@/lib/pricing'
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

  const now = new Date()
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const planName = getPlanName(client.monthly_minute_limit)
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
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Your Plan</p>
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
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">Usage This Cycle</p>
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
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Buy Minutes</p>
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
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Account</p>
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
          <div className="flex items-center justify-between">
            <span className="text-xs t3">Setup fee</span>
            <span className="text-xs t2 font-mono">${SETUP.price} (paid)</span>
          </div>
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
