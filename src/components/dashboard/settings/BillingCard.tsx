'use client'

import { useState, useEffect, useCallback } from 'react'
import { MINUTE_RELOAD_PACKS, PLANS, STRIPE_IDS } from '@/lib/pricing'

interface Invoice {
  id: string
  date: string | null
  amount: number
  currency: string
  status: string | null
  pdfUrl: string | null
  description: string
}

interface BillingCardProps {
  clientId: string
  selectedPlan: string | null
  subscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeDiscountName: string | null
  effectiveMonthlyRate: number | null
  cancelAt: string | null
  /**
   * Twilio number provisioned for the client. Required for minute reload purchase
   * — minutes only matter if the agent has a phone number to take calls on.
   * When null, the reload buttons render disabled with an explanation.
   */
  twilioNumber: string | null
  isAdmin?: boolean
}

export default function BillingCard({
  clientId,
  selectedPlan,
  subscriptionStatus,
  subscriptionCurrentPeriodEnd,
  stripeCustomerId,
  stripeDiscountName,
  effectiveMonthlyRate,
  cancelAt,
  twilioNumber,
  isAdmin,
}: BillingCardProps) {
  const hasNumber = !!twilioNumber
  const reloadsAllowed = (subscriptionStatus === 'active' || subscriptionStatus === 'past_due') && hasNumber
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [showInvoices, setShowInvoices] = useState(false)
  const [buyingMinutes, setBuyingMinutes] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const plan = PLANS.find(p => p.id === selectedPlan)
  const isActive = subscriptionStatus === 'active'
  const isPastDue = subscriptionStatus === 'past_due'
  const isCanceled = subscriptionStatus === 'canceled'
  const isCanceling = isActive && !!cancelAt

  const cancelDate = cancelAt
    ? new Date(cancelAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const periodEnd = subscriptionCurrentPeriodEnd
    ? new Date(subscriptionCurrentPeriodEnd).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const fetchInvoices = useCallback(async () => {
    if (!stripeCustomerId || loadingInvoices) return
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/billing/invoices?clientId=${clientId}`)
      const data = await res.json()
      setInvoices(data.invoices ?? [])
    } finally {
      setLoadingInvoices(false)
    }
  }, [clientId, stripeCustomerId, loadingInvoices])

  useEffect(() => {
    if (showInvoices && invoices.length === 0 && stripeCustomerId) {
      fetchInvoices()
    }
  }, [showInvoices, invoices.length, stripeCustomerId, fetchInvoices])

  const handlePortal = useCallback(async () => {
    if (!stripeCustomerId || portalLoading) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setPortalLoading(false)
    }
  }, [clientId, stripeCustomerId, portalLoading])

  const handleBuyMinutes = useCallback(async (packIndex: number) => {
    if (buyingMinutes) return
    setBuyingMinutes(true)
    try {
      const res = await fetch('/api/billing/buy-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, packIndex }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setBuyingMinutes(false)
    }
  }, [clientId, buyingMinutes])

  // Don't render for trial users with no Stripe customer
  if (!stripeCustomerId && subscriptionStatus === 'trialing') return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold t1">Billing</h3>
        {stripeCustomerId && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border b-theme t3 hover:t2 transition-colors disabled:opacity-50"
          >
            {portalLoading ? 'Opening...' : 'Manage in Stripe'}
          </button>
        )}
      </div>

      {/* Subscription status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] t3">Status</span>
          <span className={`text-[11px] font-medium ${
            isCanceling ? 'text-amber-400' : isActive ? 'text-emerald-400' : isPastDue ? 'text-amber-400' : isCanceled ? 'text-red-400' : 't2'
          }`}>
            {isCanceling ? 'Canceling' : isActive ? 'Active' : isPastDue ? 'Past due' : isCanceled ? 'Canceled' : subscriptionStatus ?? 'Unknown'}
          </span>
        </div>

        {plan && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] t3">Plan</span>
            <span className="text-[11px] font-medium t2">
              {plan.name} — ${effectiveMonthlyRate ?? plan.monthly}/mo
              {stripeDiscountName && (
                <span className="ml-1 text-emerald-400">({stripeDiscountName})</span>
              )}
            </span>
          </div>
        )}

        {periodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] t3">
              {isCanceled ? 'Ended' : 'Renews'}
            </span>
            <span className="text-[11px] font-medium t2">{periodEnd}</span>
          </div>
        )}
      </div>

      {/* Scheduled cancellation notice */}
      {isCanceling && cancelDate && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5">
          <p className="text-[11px] text-amber-300">
            Your plan ends on <span className="font-semibold">{cancelDate}</span>. You&apos;ll keep access until then.
          </p>
          {stripeCustomerId && (
            <button
              onClick={handlePortal}
              className="mt-2 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
            >
              Undo cancellation
            </button>
          )}
        </div>
      )}

      {/* Past due warning */}
      {isPastDue && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5">
          <p className="text-[11px] text-amber-300">
            Your payment failed. Update your payment method to avoid service interruption.
          </p>
          {stripeCustomerId && (
            <button
              onClick={handlePortal}
              className="mt-2 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
            >
              Update payment method
            </button>
          )}
        </div>
      )}

      {/* Minute packs */}
      {(isActive || isPastDue) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] t3">Extra minutes</p>
            {!hasNumber && (
              <span className="text-[10px] text-amber-400">Phone number required</span>
            )}
          </div>
          <div className="flex gap-2">
            {MINUTE_RELOAD_PACKS.map((pack, i) => (
              <button
                key={pack.minutes}
                onClick={() => reloadsAllowed && handleBuyMinutes(i)}
                disabled={buyingMinutes || !reloadsAllowed}
                title={!hasNumber
                  ? 'You need a provisioned phone number before you can buy minutes.'
                  : `Buy ${pack.minutes} extra minutes for $${pack.price} CAD`}
                aria-disabled={!reloadsAllowed}
                className={`flex-1 text-center text-[10px] font-medium px-2.5 py-2 rounded-lg border b-theme bg-surface transition-colors ${
                  reloadsAllowed
                    ? 'hover:bg-zinc-800 disabled:opacity-50'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="block t1 text-[12px] font-semibold">+{pack.minutes} min</span>
                <span className="t3">${pack.price} CAD</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Active promo codes */}
      {isAdmin && (
        <div className="rounded-xl border b-theme bg-hover p-3 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.1em] uppercase t3">Promo Codes (admin)</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{STRIPE_IDS.foundingPromoCode}</code>
                <span className="text-[10px] t3">$20/mo off forever</span>
              </div>
              <span className="text-[10px] t2">Lite $49 → $29/mo</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono font-semibold t2 bg-hover px-2 py-0.5 rounded">{STRIPE_IDS.betaPromoCode}</code>
                <span className="text-[10px] t3">$10/mo off forever (legacy)</span>
              </div>
              <span className="text-[10px] t3">Legacy beta</span>
            </div>
          </div>
          <p className="text-[9px] t3">Customers enter these at Stripe Checkout. Manage in Stripe Dashboard → Promotion codes.</p>
        </div>
      )}

      {/* Invoice history toggle */}
      {stripeCustomerId && (
        <div>
          <button
            onClick={() => setShowInvoices(!showInvoices)}
            className="text-[11px] t3 hover:t2 transition-colors flex items-center gap-1"
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              className={`transition-transform ${showInvoices ? 'rotate-90' : ''}`}
            >
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Recent invoices
          </button>

          {showInvoices && (
            <div className="mt-2 space-y-1.5">
              {loadingInvoices && <p className="text-[10px] t3">Loading...</p>}
              {!loadingInvoices && invoices.length === 0 && (
                <p className="text-[10px] t3">No invoices yet</p>
              )}
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-1 border-b border-zinc-800/50 last:border-0">
                  <div>
                    <span className="text-[10px] t2 block">{inv.description}</span>
                    <span className="text-[10px] t3">
                      {inv.date ? new Date(inv.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium ${
                      inv.status === 'paid' ? 'text-emerald-400' : inv.status === 'open' ? 'text-amber-400' : 't3'
                    }`}>
                      ${inv.amount.toFixed(2)} {inv.currency}
                    </span>
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
