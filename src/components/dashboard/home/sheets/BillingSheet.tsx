'use client'

/**
 * BillingSheet — plan summary + upgrade CTA inside HomeSideSheet.
 */

import { getPlanEntitlements } from '@/lib/plan-entitlements'

interface Props {
  clientId: string | null
  selectedPlan: string | null
  subscriptionStatus: string | null
}

const PLAN_COLORS: Record<string, string> = {
  lite: 'var(--color-text-3)',
  core: 'var(--color-primary)',
  pro: 'rgb(168,85,247)',
  trial: 'rgb(245,158,11)',
}

export default function BillingSheet({ selectedPlan, subscriptionStatus }: Props) {
  const isTrial = subscriptionStatus === 'trialing'
  const planId = (isTrial ? 'trial' : (selectedPlan ?? null)) as Parameters<typeof getPlanEntitlements>[0]
  const plan = getPlanEntitlements(planId)
  const planColor = PLAN_COLORS[planId ?? 'lite'] ?? PLAN_COLORS.lite

  const features: { label: string; enabled: boolean }[] = [
    { label: 'SMS follow-up', enabled: plan.smsEnabled },
    { label: 'Calendar booking', enabled: plan.bookingEnabled },
    { label: 'Live transfer', enabled: plan.transferEnabled },
    { label: 'Knowledge base', enabled: plan.knowledgeEnabled },
    { label: 'Learning Loop (weekly AI review)', enabled: plan.learningLoopEnabled },
    { label: 'File uploads', enabled: plan.fileUploadEnabled },
  ]

  return (
    <div className="space-y-6">
      {/* Current plan badge */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ border: `1px solid ${planColor}33` }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: planColor }}>Current Plan</p>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${planColor}18`, color: planColor }}
          >
            {plan.name}
          </span>
        </div>
        <p className="text-sm t1">
          <span className="font-bold">{plan.minutes}</span>
          <span className="t3"> minutes / month</span>
        </p>
      </div>

      {/* Feature list */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Included Features</p>
        {features.map(f => (
          <div key={f.label} className="flex items-center gap-2">
            {f.enabled ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-success)' }} className="shrink-0">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            <span className={`text-xs ${f.enabled ? 't1' : 't3'}`}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Upgrade CTA */}
      {(isTrial || selectedPlan === 'lite' || selectedPlan === 'core') && (
        <a
          href="/dashboard/settings?tab=billing"
          className="block w-full py-2.5 rounded-xl text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {isTrial ? 'Get a phone number →' : 'Upgrade plan →'}
        </a>
      )}

      <a
        href="/dashboard/settings?tab=billing"
        className="block text-center text-xs font-semibold"
        style={{ color: 'var(--color-text-3)' }}
      >
        Manage billing & invoices →
      </a>
    </div>
  )
}
