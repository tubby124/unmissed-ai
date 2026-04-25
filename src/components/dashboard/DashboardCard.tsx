'use client'

import type { ReactNode, HTMLAttributes } from 'react'

export interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Stable id from `dashboardCardManifest` — wired into a `data-card-id` attr for future drag/reorder. */
  cardId: string
  /** Where this card lives. Used by future surface filtering. */
  surface?: 'overview' | 'settings' | 'both'
  children: ReactNode
}

/**
 * Track 3 (D286) — Thin wrapper around any dashboard card.
 *
 * Today: just adds `role="region"`, a stable `data-card-id`, and a `data-surface` attr.
 * Tomorrow: lets us turn cards on/off, drag them, or A/B test surfaces without rewriting markup.
 *
 * Visual change: zero. This is intentionally a no-op wrapper.
 */
export default function DashboardCard({
  cardId,
  surface = 'both',
  children,
  className,
  ...rest
}: DashboardCardProps) {
  return (
    <div
      role="region"
      data-card-id={cardId}
      data-surface={surface}
      className={className}
      {...rest}
    >
      {children}
    </div>
  )
}
