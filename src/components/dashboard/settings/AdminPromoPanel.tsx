'use client'

import { useState } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { STRIPE_IDS } from '@/lib/pricing'

interface AdminPromoPanelProps {
  clientId: string
  client: ClientConfig
}

export default function AdminPromoPanel({ clientId, client }: AdminPromoPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discountName, setDiscountName] = useState<string | null>(client.stripe_discount_name)
  const [effectiveRate, setEffectiveRate] = useState<number | null>(client.effective_monthly_rate)

  async function handleApply() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/apply-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, action: 'apply', coupon_id: STRIPE_IDS.betaCoupon }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDiscountName(data.discountName)
      setEffectiveRate(data.effectiveRate)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/apply-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, action: 'remove' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDiscountName(data.discountName)
      setEffectiveRate(data.effectiveRate)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/subscription-info?client_id=${clientId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.discount) {
        setDiscountName(data.discount.name)
        setEffectiveRate(data.effectiveMonthly)
      } else {
        setDiscountName(null)
        setEffectiveRate(null)
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-5 border-b b-theme">
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3 mb-3">Admin: Promo Management</p>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs t3">Current discount:</span>
        {discountName ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-green-400 border-green-500/30 bg-green-500/10">
            {discountName} — ${effectiveRate}/mo
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border t3 b-theme">
            None — full price
          </span>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-400 mb-2">{error}</p>
      )}

      <div className="flex items-center gap-2">
        {!discountName ? (
          <button
            disabled={loading}
            onClick={handleApply}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? '...' : `Apply BETA20`}
          </button>
        ) : (
          <button
            disabled={loading}
            onClick={handleRemove}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? '...' : 'Remove Discount'}
          </button>
        )}
        <button
          disabled={loading}
          onClick={handleRefresh}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg b-theme hover:bg-hover t2 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? '...' : 'Refresh from Stripe'}
        </button>
      </div>
    </div>
  )
}
