/**
 * Track 3 (D286) — Dashboard card manifest.
 *
 * Single source of truth for which cards exist, where they live, and who sees them.
 * Currently consumed by: nothing (additive primitive). Future consumers will filter
 * `AgentTab.tsx` and `UnifiedHomeSection.tsx` over this list instead of hardcoding JSX.
 *
 * Per Omar's 2026-04-25 guidance: keep Overview surfaces ruthlessly limited to what
 * a 60+ property manager edits regularly. Everything else is `surface: 'settings'`.
 */

export type DashboardSurface = 'overview' | 'settings' | 'both'
export type PlanGate = 'lite' | 'core' | 'pro' | 'trial' | 'any'

export interface DashboardCardEntry {
  /** Stable id used by `<DashboardCard cardId>` for data-attr targeting. */
  id: string
  /** Human-readable card title (also used in surface-toggle UIs). */
  title: string
  /** Where this card belongs. */
  surface: DashboardSurface
  /** Visible by default. Future per-user toggles can override. */
  defaultVisible: boolean
  /** Minimum plan required (or 'any'). */
  planGate: PlanGate
  /** Niche-gate. Use 'any' to expose to every niche; otherwise an allowlist. */
  niches: 'any' | string[]
  /** True = only admins/staff see this. */
  adminOnly: boolean
  /** One-line note for vault/docs — NOT shown in UI. */
  note?: string
}

export const DASHBOARD_CARD_MANIFEST: DashboardCardEntry[] = [
  // ─── Overview surface — what owners edit weekly ────────────────────────────
  {
    id: 'agent-speaks',
    title: 'What your agent says',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
    note: 'Greeting + after-call SMS. Track 1.',
  },
  {
    id: 'voice-picker',
    title: 'Choose voice',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'capabilities',
    title: 'What your agent can do',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'agent-knows',
    title: 'What your agent knows',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'agent-routes-on',
    title: 'How your agent routes calls',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'overview-call-log',
    title: 'Recent calls',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'today-update',
    title: "Today's update",
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'stats-hero',
    title: 'Stats',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'test-call',
    title: 'Test your agent',
    surface: 'overview',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },

  // ─── Settings surface — advanced configuration ─────────────────────────────
  {
    id: 'agent-identity',
    title: 'Agent name + business name',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
    note: 'Demoted from Overview per Omar 2026-04-25 — bake the name into greeting instead.',
  },
  {
    id: 'hours',
    title: 'Business hours',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'voicemail',
    title: 'Voicemail greeting',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'ivr',
    title: 'IVR (digit menu)',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'booking',
    title: 'Calendar booking',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'pro',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'transfer',
    title: 'Call transfer',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'pro',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'knowledge-engine',
    title: 'Knowledge backend',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'website-knowledge',
    title: 'Website scrape',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'context-data',
    title: 'Reference data',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'services-offered',
    title: 'Services',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'staff-roster',
    title: 'Staff roster',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: ['property_management', 'medical', 'real_estate'],
    adminOnly: false,
  },
  {
    id: 'vip-contacts',
    title: 'VIP contacts',
    surface: 'settings',
    defaultVisible: false,
    planGate: 'pro',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'prompt-editor',
    title: 'System prompt editor',
    surface: 'settings',
    defaultVisible: true,
    planGate: 'any',
    niches: 'any',
    adminOnly: false,
  },
  {
    id: 'prompt-versions',
    title: 'Prompt history',
    surface: 'settings',
    defaultVisible: false,
    planGate: 'any',
    niches: 'any',
    adminOnly: true,
  },
  {
    id: 'agent-config',
    title: 'Agent config (advanced)',
    surface: 'settings',
    defaultVisible: false,
    planGate: 'any',
    niches: 'any',
    adminOnly: true,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    surface: 'settings',
    defaultVisible: false,
    planGate: 'pro',
    niches: 'any',
    adminOnly: true,
  },
  {
    id: 'god-mode',
    title: 'God mode',
    surface: 'settings',
    defaultVisible: false,
    planGate: 'any',
    niches: 'any',
    adminOnly: true,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

export function cardsForSurface(
  surface: DashboardSurface,
  ctx: { plan: PlanGate; niche: string | null; isAdmin: boolean },
): DashboardCardEntry[] {
  return DASHBOARD_CARD_MANIFEST.filter(c => {
    if (c.surface !== surface && c.surface !== 'both') return false
    if (c.adminOnly && !ctx.isAdmin) return false
    if (!c.defaultVisible && !ctx.isAdmin) return false
    if (c.planGate !== 'any' && c.planGate !== ctx.plan) {
      // Pro is a superset of core; trial unlocks everything.
      const proSuperset = ctx.plan === 'pro' && c.planGate === 'core'
      const trialUnlocksAll = ctx.plan === 'trial'
      if (!proSuperset && !trialUnlocksAll) return false
    }
    if (c.niches !== 'any') {
      if (!ctx.niche || !c.niches.includes(ctx.niche)) return false
    }
    return true
  })
}

export function getCard(id: string): DashboardCardEntry | undefined {
  return DASHBOARD_CARD_MANIFEST.find(c => c.id === id)
}
