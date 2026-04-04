'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { PLANS, MINUTE_RELOAD_PACKS, TRIAL } from '@/lib/pricing'
import { getPlanEntitlements, getUpgradePlan } from '@/lib/plan-entitlements'
import type { PlanIdOrTrial } from '@/lib/plan-entitlements'
import DangerZoneCard from './DangerZoneCard'
import AdminPromoPanel from './AdminPromoPanel'
import AdminRecomposePanel from './AdminRecomposePanel'
import UsageSummary from '@/components/dashboard/UsageSummary'

interface BillingTabProps {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
  minutesUsed: number
  minuteLimit: number
  totalAvailable: number
  usagePct: number
}

interface Invoice {
  id: string
  date: string | null
  amount: number
  currency: string
  status: string | null
  pdfUrl: string | null
  description: string
}

interface PeriodStats {
  totalCalls: number
  aiResolvedPct: number
  avgCallMin: number
  avgCallSec: number
  voicemails: number
}

// Simplified chips per plan for the comparison cards
const PLAN_CHIPS: Record<string, string[]> = {
  trial: [`${TRIAL.minutes} min trial`, 'Basic agent', 'SMS follow-up', 'Telegram alerts'],
  lite: ['100 min/mo', 'Call summaries', 'Lead scoring', 'SMS follow-up'],
  core: ['400 min/mo', 'Website knowledge', 'Caller ranking', 'Daily digest'],
  pro: ['1,000 min/mo', 'Calendar booking', 'Live transfer', 'Priority support'],
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
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [buyingMinutes, setBuyingMinutes] = useState(false)
  const [showMinutePacks, setShowMinutePacks] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null)

  const isTrial = client.subscription_status === 'trialing'
  const isActive = client.subscription_status === 'active'

  const effectivePlanId: PlanIdOrTrial = isTrial ? 'trial' : (client.selected_plan as PlanIdOrTrial) ?? 'lite'
  const entitlements = getPlanEntitlements(effectivePlanId)
  const upgradePlan = getUpgradePlan(effectivePlanId)

  const trialDaysLeft = (() => {
    if (!isTrial || !client.subscription_current_period_end) return null
    const diff = new Date(client.subscription_current_period_end).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()

  const usageBarColor =
    usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  // Fetch this-period call stats from home API
  useEffect(() => {
    async function fetchStats() {
      try {
        const url = isAdmin
          ? `/api/dashboard/home?clientId=${client.id}`
          : '/api/dashboard/home'
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const s = data.stats ?? {}
        const total = s.totalCalls ?? 0
        const missed = s.missedThisMonth ?? 0
        const aiResolved = total > 0 ? Math.round(((total - missed) / total) * 100) : 0
        const totalSec = (s.timeSavedMinutes ?? 0) * 60
        const avgSec = total > 0 ? Math.round(totalSec / total) : 0
        setPeriodStats({
          totalCalls: total,
          aiResolvedPct: aiResolved,
          avgCallMin: Math.floor(avgSec / 60),
          avgCallSec: avgSec % 60,
          voicemails: missed,
        })
      } catch {
        // leave null — stats card shows dashes
      }
    }
    fetchStats()
  }, [client.id, isAdmin])

  // Fetch invoices (only if stripe customer exists)
  useEffect(() => {
    if (!client.stripe_customer_id) {
      setLoadingInvoices(false)
      return
    }
    async function fetchInvoices() {
      try {
        const res = await fetch(`/api/billing/invoices?clientId=${client.id}`)
        const data = await res.json()
        setInvoices(data.invoices ?? [])
      } finally {
        setLoadingInvoices(false)
      }
    }
    fetchInvoices()
  }, [client.id, client.stripe_customer_id])

  async function handleUpgrade(planId: string) {
    if (previewMode) return
    setUpgrading(planId)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, planId, billing: 'monthly' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setUpgrading(null)
    }
  }

  async function handlePortal() {
    if (!client.stripe_customer_id || portalLoading) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleBuyMinutes(packIndex: number) {
    if (buyingMinutes || previewMode) return
    setBuyingMinutes(true)
    try {
      const res = await fetch('/api/billing/buy-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, packIndex }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setBuyingMinutes(false)
    }
  }

  const planLabel = isTrial ? 'Free Trial' : (entitlements.name ?? 'Plan')

  // Build comparison plan rows: trial entry (if trialing) + all PLANS
  const comparisonRows = [
    ...(isTrial
      ? [{ id: 'trial', name: 'Free Trial', priceLabel: '$0', isCurrent: true }]
      : []),
    ...PLANS.map(p => ({
      id: p.id,
      name: p.name,
      priceLabel: `$${p.monthly}/mo`,
      isCurrent: !isTrial && p.id === client.selected_plan,
    })),
  ]

  const periodEnd = client.subscription_current_period_end
    ? new Date(client.subscription_current_period_end).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div className="space-y-4">
      {/* Past-due warning */}
      {client.subscription_status === 'past_due' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3">
          <p className="text-xs font-medium text-red-400">
            Payment failed — your agent may pause. Please update your payment method.
          </p>
        </div>
      )}

      {/* ── Row 1: 3 stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Current Plan */}
        <div className="rounded-2xl border b-theme bg-surface p-5 flex flex-col">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-400 mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Current Plan
          </p>
          <p className="text-2xl font-bold t1 mb-1">{planLabel}</p>
          <p className="text-[12px] t3 mb-5">
            {isTrial && trialDaysLeft !== null
              ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`
              : isActive && periodEnd
                ? `Renews ${periodEnd}`
                : client.subscription_status === 'canceled'
                  ? 'No active subscription'
                  : null}
          </p>
          <div className="mt-auto">
            {upgradePlan ? (
              <button
                onClick={() => handleUpgrade(upgradePlan.id)}
                disabled={!!upgrading || !!previewMode}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {upgrading === upgradePlan.id ? 'Redirecting...' : `Upgrade to ${upgradePlan.name} →`}
              </button>
            ) : client.stripe_customer_id ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full border b-theme hover:bg-hover text-sm font-semibold py-2.5 rounded-xl transition-colors t2 disabled:opacity-50 cursor-pointer"
              >
                {portalLoading ? 'Redirecting...' : 'Manage Subscription'}
              </button>
            ) : null}
          </div>
        </div>

        {/* Minutes Usage */}
        <div className="rounded-2xl border b-theme bg-surface p-5 flex flex-col">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-blue-400 mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Minutes Usage
          </p>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-3xl font-bold t1">{minutesUsed}</span>
            <span className="text-sm t3">/ {totalAvailable} minutes</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all ${usageBarColor}`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
          <p className="text-[11px] t3 mb-5">
            Resets: {isTrial ? 'never (trial)' : 'monthly'}
          </p>
          <div className="mt-auto">
            {!showMinutePacks ? (
              <button
                onClick={() => setShowMinutePacks(true)}
                className="w-full border b-theme hover:bg-hover text-xs font-semibold py-2 rounded-lg transition-colors t2 cursor-pointer"
              >
                Add more minutes
              </button>
            ) : (
              <div className="space-y-2">
                {MINUTE_RELOAD_PACKS.map((pack, i) => (
                  <button
                    key={pack.minutes}
                    onClick={() => handleBuyMinutes(i)}
                    disabled={buyingMinutes || !!previewMode}
                    className="w-full flex justify-between items-center border b-theme hover:bg-hover text-xs font-semibold py-2 px-3 rounded-lg transition-colors t2 disabled:opacity-50 cursor-pointer"
                  >
                    <span>+{pack.minutes} min</span>
                    <span className="t3">${pack.price} CAD</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calls This Period */}
        <div className="rounded-2xl border b-theme bg-surface p-5 flex flex-col">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-emerald-400 mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Calls This Period
          </p>
          <p className="text-3xl font-bold t1 mb-1">
            {periodStats ? periodStats.totalCalls : '—'}
          </p>
          <p className="text-[12px] t3 mb-5">
            {periodStats
              ? `AI resolved: ${periodStats.aiResolvedPct}%`
              : 'Loading...'}
          </p>
          {periodStats && (
            <div className="mt-auto space-y-2 border-t b-theme pt-3">
              <div className="flex justify-between text-[12px]">
                <span className="t3">Avg call length</span>
                <span className="t2 font-medium tabular-nums">
                  {periodStats.avgCallMin}m {periodStats.avgCallSec}s
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="t3">Voicemails</span>
                <span className="t2 font-medium tabular-nums">{periodStats.voicemails}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Plan Comparison + Payment & Invoices ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Plan Comparison */}
        <div className="lg:col-span-2 rounded-2xl border b-theme bg-surface p-5">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-4 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="6" height="18" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="9" y="8" width="6" height="13" rx="1" stroke="currentColor" strokeWidth="2"/>
              <rect x="16" y="5" width="6" height="16" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Plan Comparison
          </p>
          <div className="space-y-3">
            {comparisonRows.map(row => {
              const chips = PLAN_CHIPS[row.id] ?? []
              return (
                <div
                  key={row.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    row.isCurrent
                      ? 'border-amber-500/40 bg-amber-500/[0.05]'
                      : 'b-theme bg-hover'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold t1">{row.name}</span>
                      {row.isCurrent && (
                        <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-400 bg-amber-500/10">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${row.isCurrent ? 'text-amber-400' : 't2'}`}>
                      {row.priceLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map(chip => (
                      <span
                        key={chip}
                        className="text-[10px] px-2 py-0.5 rounded-full border b-theme t3"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  {!row.isCurrent && row.id !== 'trial' && (
                    <button
                      onClick={() => handleUpgrade(row.id)}
                      disabled={!!upgrading || !!previewMode}
                      className="mt-3 w-full text-[11px] font-semibold py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {upgrading === row.id ? 'Redirecting...' : `Upgrade to ${row.name}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment & Invoices */}
        <div className="lg:col-span-3 rounded-2xl border b-theme bg-surface p-5">
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-4 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Payment &amp; Invoices
          </p>

          {!client.stripe_customer_id ? (
            /* No payment method state */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-hover border b-theme flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="t3">
                  <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-semibold t1 mb-1">No payment method</p>
              <p className="text-xs t3 mb-5 max-w-[240px]">
                Add a card to upgrade and keep your agent running after trial ends.
              </p>
              {upgradePlan && (
                <button
                  onClick={() => handleUpgrade(upgradePlan.id)}
                  disabled={!!upgrading || !!previewMode}
                  className="px-5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {upgrading ? 'Redirecting...' : 'Add payment method'}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Payment method row */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border b-theme bg-hover mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
                      <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold t1">Card on file</p>
                    <p className="text-[10px] t3">Manage in Stripe portal</p>
                  </div>
                </div>
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border b-theme hover:bg-hover t2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {portalLoading ? '...' : 'Manage'}
                </button>
              </div>

              {/* Invoice History */}
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-3">
                Invoice History
              </p>
              {loadingInvoices && (
                <p className="text-xs t3 py-4 text-center">Loading...</p>
              )}
              {!loadingInvoices && invoices.length === 0 && (
                <p className="text-xs t3 py-6 text-center">No invoices yet</p>
              )}
              {!loadingInvoices && invoices.length > 0 && (
                <div className="space-y-0">
                  {invoices.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-2.5 border-b b-theme last:border-0"
                    >
                      <div>
                        <span className="text-[11px] t2 block font-medium">{inv.description}</span>
                        <span className="text-[10px] t3">
                          {inv.date
                            ? new Date(inv.date).toLocaleDateString('en-CA', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            inv.status === 'paid'
                              ? 'text-emerald-400'
                              : inv.status === 'open'
                                ? 'text-amber-400'
                                : 't3'
                          }`}
                        >
                          ${inv.amount.toFixed(2)} {inv.currency?.toUpperCase()}
                        </span>
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Admin-only sections ──────────────────────────────────────── */}
      {isAdmin && client.stripe_subscription_id && (
        <AdminPromoPanel clientId={client.id} client={client} />
      )}
      {isAdmin && <AdminRecomposePanel clientId={client.id} />}
      {isAdmin && <UsageSummary isAdmin={isAdmin} />}

      {/* Danger Zone */}
      {!previewMode && (
        <DangerZoneCard clientId={client.id} previewMode={previewMode} />
      )}
    </div>
  )
}
