export interface NavItem {
  href: string
  label: string
  adminLabel?: string
  adminOnly: boolean
  group: number
  iconName: string
}

export const GROUP_LABELS: Record<number, string | null> = {
  1: null,
  2: 'CLIENTS',
  3: 'MANAGE',
  4: 'TOOLS',
  5: null,
}

export const NAV_ITEMS: NavItem[] = [
  // ── Group 1 ──────────────────────────────────────────────────────────────
  { href: '/dashboard', label: 'Command Center', adminOnly: true, group: 1, iconName: 'command-center' },
  { href: '/dashboard/calls', label: 'Overview', adminOnly: false, group: 1, iconName: 'phone' },
  { href: '/dashboard/insights', label: 'Insights', adminOnly: false, group: 1, iconName: 'bar-chart' },
  { href: '/dashboard/live', label: 'Live', adminOnly: false, group: 1, iconName: 'broadcast' },
  { href: '/dashboard/setup', label: 'Agent', adminOnly: false, group: 1, iconName: 'wrench' },
  { href: '/dashboard/advisor', label: 'Advisor', adminOnly: false, group: 1, iconName: 'message-dots' },
  // ── Group 2 — CLIENTS (admin) ───────────────────────────────────────────
  { href: '/dashboard/clients', label: 'Clients', adminOnly: true, group: 2, iconName: 'users' },
  { href: '/dashboard/campaigns', label: 'Performance', adminOnly: true, group: 2, iconName: 'chart-columns' },
  // ── Group 3 — MANAGE ────────────────────────────────────────────────────
  { href: '/dashboard/leads', label: 'Leads', adminLabel: 'Outbound Queue', adminOnly: false, group: 3, iconName: 'list' },
  { href: '/dashboard/intake', label: 'Intake', adminOnly: true, group: 3, iconName: 'inbox' },
  { href: '/dashboard/calendar', label: 'Calendar', adminOnly: false, group: 3, iconName: 'calendar' },
  { href: '/dashboard/notifications', label: 'Notifications', adminOnly: false, group: 3, iconName: 'bell' },
  // ── Group 4 — TOOLS (admin) ─────────────────────────────────────────────
  { href: '/dashboard/demos', label: 'Demos', adminOnly: true, group: 4, iconName: 'activity' },
  { href: '/dashboard/lab', label: 'Lab', adminOnly: true, group: 4, iconName: 'grid' },
  { href: '/dashboard/costs', label: 'Cost Intel', adminOnly: true, group: 4, iconName: 'dollar' },
  { href: '/dashboard/numbers', label: 'Numbers', adminOnly: true, group: 4, iconName: 'smartphone' },
  { href: '/dashboard/voices', label: 'Voices', adminOnly: true, group: 4, iconName: 'microphone' },
  // ── Group 5 — bottom ────────────────────────────────────────────────────
  { href: '/dashboard/settings', label: 'Settings', adminOnly: false, group: 5, iconName: 'settings' },
]
