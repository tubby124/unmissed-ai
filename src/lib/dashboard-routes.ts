// ── Dashboard route constants + query-param validation ────────────────────────
// Single source of truth for all dashboard URLs.
// Phase 3 (ClientHome) and Phase 4 (KnowledgePageView) consume the parsers.
// No component should hard-code these URL strings.
//
// Knowledge deep-link reference (Gate 0 verified 2026-03-27):
//   Browse + source registry:  /dashboard/knowledge?tab=browse
//   Add website:               /dashboard/knowledge?tab=add&source=website
//   Add manual facts/QA:       /dashboard/knowledge?tab=add&source=manual
//   Add bulk text:             /dashboard/knowledge?tab=add&source=text
//   Gaps + suggestions:        /dashboard/knowledge?tab=gaps
//   (Compiler review — Gate 4): /dashboard/knowledge?tab=browse&draft=<id>
//
// NOTE: /dashboard/settings?tab=knowledge does NOT exist for non-admins.
//       All knowledge entry points for owners must use /dashboard/knowledge.

// ── Valid param values ───────────────────────────────────────────────────────

export const VALID_DASHBOARD_TABS = ['overview', 'activity'] as const
export type DashboardTab = (typeof VALID_DASHBOARD_TABS)[number]

export const VALID_OVERVIEW_SECTIONS = [
  'identity',
  'call-handling',
  'knowledge',
  'notifications',
  'billing',
] as const
export type OverviewSection = (typeof VALID_OVERVIEW_SECTIONS)[number]

export const VALID_KNOWLEDGE_TABS = ['browse', 'add', 'gaps'] as const
export type KnowledgeTab = (typeof VALID_KNOWLEDGE_TABS)[number]

export const VALID_ADD_SOURCES = ['website', 'manual', 'text'] as const
export type AddSource = (typeof VALID_ADD_SOURCES)[number]

// ── Parsers (coerce unknown input → safe default) ────────────────────────────

export function parseDashboardTab(raw: string | null | undefined): DashboardTab {
  return (VALID_DASHBOARD_TABS as readonly string[]).includes(raw ?? '')
    ? (raw as DashboardTab)
    : 'overview'
}

export function parseOverviewSection(raw: string | null | undefined): OverviewSection | null {
  return (VALID_OVERVIEW_SECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as OverviewSection)
    : null
}

export function parseKnowledgeTab(raw: string | null | undefined): KnowledgeTab {
  return (VALID_KNOWLEDGE_TABS as readonly string[]).includes(raw ?? '')
    ? (raw as KnowledgeTab)
    : 'browse'
}

export function parseAddSource(raw: string | null | undefined): AddSource {
  return (VALID_ADD_SOURCES as readonly string[]).includes(raw ?? '')
    ? (raw as AddSource)
    : 'website'
}

// ── Route builders ───────────────────────────────────────────────────────────

export const dashboardRoutes = {
  overview: (section?: OverviewSection) =>
    section ? `/dashboard?tab=overview&section=${section}` : '/dashboard?tab=overview',
  activity: () => '/dashboard?tab=activity',
  overviewSection: (s: OverviewSection) => `/dashboard?tab=overview&section=${s}`,
} as const

export const knowledgeRoutes = {
  browse: () => '/dashboard/knowledge?tab=browse',
  add: (source?: AddSource) =>
    source ? `/dashboard/knowledge?tab=add&source=${source}` : '/dashboard/knowledge?tab=add',
  gaps: () => '/dashboard/knowledge?tab=gaps',
} as const
